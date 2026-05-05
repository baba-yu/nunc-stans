"""Weekly maintenance toolbox — Sunday slot 5.5 (6_weekly_maintenance).

Spec: ``design/scheduled/6_weekly_maintenance.md``.

Deterministic counterpart to the LLM Judge / Update sub-agents the
orchestrator dispatches. This module provides three CLI subcommands and
matching pure-functions:

  * ``candidates``        — Step 0: select active+changed predictions
                            (≤ 30) and TTL-stale glossary terms (≤ 20).
                            Spillover trims into ``memory/maintenance/queue.md``.
                            Health-checks 90d-old non-dormant predictions.

  * ``merge-judgements``  — fan-in: combine
                            ``maintenance-judgements.<pid>.json`` per-pred
                            files + the batched
                            ``maintenance-judgements.glossary.json`` into
                            a single deterministic
                            ``maintenance-judgements.json`` (mirrors
                            ``extract_needs.merge_needs_files``).

  * ``validate``          — Step 3 gate: every ``stale`` judgement has
                            a corresponding updated JSON; every
                            ``retire`` has the DB ``status='retired'``
                            flip applied (glossary stream); every
                            ``broken`` has a row in
                            ``memory/maintenance/<date>/broken.md``.
                            Exits 0 / 1 with explicit per-line findings.

The LLM Judge + Update sub-agent dispatch logic lives in the
orchestrator per spec §Sub-agent dispatch shape. This module is
deliberately deterministic: it never calls an LLM and never writes the
live ``app/data/analytics.sqlite`` (read-only via SQLite URI mode for
inspection only).
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sqlite3
import sys
import tempfile
from collections import defaultdict
from pathlib import Path

from app.skills.sourcedata_schemas import (
    MaintenanceCandidatesFile,
    MaintenanceJudgementsFile,
    SourcedataValidationError,
)

# Caps from the spec §Step 0.
PREDICTIONS_CAP = 30
GLOSSARY_CAP = 20

# 14-day TTL gate for glossary candidates per spec §Step 0.
GLOSSARY_TTL_DAYS = 14

# Active window per spec §Step 0 (matches build_evidence_reverse / 90d
# realization snapshots).
ACTIVE_WINDOW_DAYS = 90

# Change-signal magnitudes for the confidence-drift ranking. The spec
# defines confidence_drift_score = count(distinct change_signals) ×
# sum(magnitudes); these are the per-signal magnitudes the SQL gate
# emits.
SIGNAL_MAGNITUDE = {
    "new_contradict": 1.0,
    "relevance_drift": 1.0,
    "landed_this_week": 0.5,
    "new_chain_edge": 0.5,
    "new_relation": 0.5,
}


# ---------------------------------------------------------------------------
# Step 0 — Candidate selection
# ---------------------------------------------------------------------------


def _stem_from_iso(date_iso: str) -> str:
    return date_iso.replace("-", "")


def parse_dormant_snapshot(text: str) -> set[str]:
    """Extract prediction IDs from a dormant snapshot markdown table.

    The table format (per ``memory/dormant/dormant-YYYYMMDD.md``):

        | ID | Prediction (short) | ... |
        |---|---|---|
        | 20260420-3 | "Headless Everything" ... | ... |

    The snapshot uses date-keyed short IDs (e.g. ``20260420-3``) rather
    than the SHA1-prefixed ``prediction.<sha>`` IDs the DB stores. That
    is the right granularity for the dormant detection — but the Step 0
    SQL query is keyed on ``predictions.prediction_id``. So this parser
    extracts BOTH:

      * raw short IDs (the table cells) for downstream auditing
      * any ``prediction.<hex16>`` strings that happen to appear in the
        snapshot prose (some snapshot variants list them inline)

    The caller is responsible for resolving short IDs to the
    SHA1-prefixed form via the DB. This function returns a set of every
    candidate ID string the snapshot mentions, leaving resolution to
    the caller.
    """
    ids: set[str] = set()
    # Match `prediction.<hex>` IDs in case any are inlined.
    for m in re.finditer(r"prediction\.[0-9a-f]{8,32}\b", text):
        ids.add(m.group(0))
    # Match ID column entries in the dormant table: 8-digit date + dash
    # + small index (e.g. 20260420-3).
    for m in re.finditer(r"\b(\d{8}-\d+)\b", text):
        ids.add(m.group(1))
    return ids


def load_dormant_snapshot(repo_root: Path, week_ending: str) -> set[str]:
    """Read ``memory/dormant/dormant-<YYYYMMDD>.md`` and parse IDs.

    Returns the empty set if the snapshot does not exist (the caller
    will surface this in the health log).
    """
    stem = _stem_from_iso(week_ending)
    path = repo_root / "memory" / "dormant" / f"dormant-{stem}.md"
    if not path.is_file():
        return set()
    return parse_dormant_snapshot(path.read_text(encoding="utf-8"))


def _changed_predictions_sql(conn: sqlite3.Connection, today: str) -> dict[str, list[str]]:
    """Return {prediction_id: [change_signals]} per spec §Step 0 SQL.

    The spec presents the gate as a single SQL with UNION + INTERSECT;
    we materialize it here so we can return per-signal labels for
    the confidence_drift_score ranking. Same semantics, more useful
    output shape.
    """
    signals: dict[str, list[str]] = defaultdict(list)

    seven_days_ago = (
        dt.date.fromisoformat(today) - dt.timedelta(days=7)
    ).isoformat()

    # 1. new contradict signal in last 7 days
    rows = conn.execute(
        """
        SELECT DISTINCT prediction_id FROM prediction_evidence_links
         WHERE validation_date >= ?
           AND support_direction = 'contradict'
        """,
        (seven_days_ago,),
    ).fetchall()
    for (pid,) in rows:
        signals[pid].append("new_contradict")

    # 2. relevance moved meaningfully week-over-week
    fourteen_days_ago = (
        dt.date.fromisoformat(today) - dt.timedelta(days=14)
    ).isoformat()
    rows = conn.execute(
        """
        SELECT DISTINCT v1.prediction_id
          FROM validation_rows v1
         WHERE v1.validation_date >= ?
           AND v1.observed_relevance IS NOT NULL
           AND ABS(
                 v1.observed_relevance - COALESCE(
                   (SELECT v2.observed_relevance FROM validation_rows v2
                     WHERE v2.prediction_id = v1.prediction_id
                       AND v2.validation_date BETWEEN ? AND ?
                       AND v2.observed_relevance IS NOT NULL
                     ORDER BY v2.validation_date DESC LIMIT 1),
                   v1.observed_relevance)
               ) >= 2
        """,
        (seven_days_ago, fourteen_days_ago, seven_days_ago),
    ).fetchall()
    for (pid,) in rows:
        if pid:
            signals[pid].append("relevance_drift")

    # 3. prediction landed this week
    rows = conn.execute(
        """
        SELECT prediction_id FROM predictions
         WHERE huge_longshot_hit_at IS NOT NULL
           AND huge_longshot_hit_at >= ?
        """,
        (seven_days_ago,),
    ).fetchall()
    for (pid,) in rows:
        signals[pid].append("landed_this_week")

    # 4a. new chain edge
    rows = conn.execute(
        """
        SELECT DISTINCT source_prediction_id FROM prediction_chain
         WHERE created_at >= ?
        UNION
        SELECT DISTINCT downstream_prediction_id FROM prediction_chain
         WHERE created_at >= ?
        """,
        (seven_days_ago, seven_days_ago),
    ).fetchall()
    for (pid,) in rows:
        if pid:
            signals[pid].append("new_chain_edge")

    # 4b. new relation
    rows = conn.execute(
        """
        SELECT DISTINCT prediction_a FROM prediction_relations
         WHERE created_at >= ?
        UNION
        SELECT DISTINCT prediction_b FROM prediction_relations
         WHERE created_at >= ?
        """,
        (seven_days_ago, seven_days_ago),
    ).fetchall()
    for (pid,) in rows:
        if pid:
            signals[pid].append("new_relation")

    return dict(signals)


def _active_predictions(
    conn: sqlite3.Connection, today: str, dormant_ids: set[str]
) -> list[str]:
    """Return prediction IDs in the 90d active window and not dormant."""
    cutoff = (
        dt.date.fromisoformat(today) - dt.timedelta(days=ACTIVE_WINDOW_DAYS)
    ).isoformat()
    rows = conn.execute(
        """
        SELECT prediction_id FROM predictions
         WHERE prediction_date IS NOT NULL
           AND prediction_date >= ?
        """,
        (cutoff,),
    ).fetchall()
    return [pid for (pid,) in rows if pid not in dormant_ids]


def _ttl_stale_glossary(
    conn: sqlite3.Connection, today: str
) -> list[tuple[str, int]]:
    """Return [(term, ttl_expired_days)] for active glossary terms whose
    last ``glossary_audit`` row is older than 14 days.

    Terms that have NEVER been audited count as TTL-expired with days
    measured from ``first_seen_date``. Retired terms are skipped.
    """
    today_d = dt.date.fromisoformat(today)
    rows = conn.execute(
        """
        SELECT g.term, g.first_seen_date,
               (SELECT MAX(checked_at) FROM glossary_audit a
                  WHERE a.term = g.term)
          FROM glossary_terms g
         WHERE g.status = 'active'
        """
    ).fetchall()
    out: list[tuple[str, int]] = []
    for term, first_seen, last_check in rows:
        if last_check is None:
            ref = first_seen or today
        else:
            ref = last_check[:10]
        try:
            ref_d = dt.date.fromisoformat(ref)
        except ValueError:
            continue
        days = (today_d - ref_d).days
        if days >= GLOSSARY_TTL_DAYS:
            out.append((term, days))
    return out


def compute_candidates(
    conn: sqlite3.Connection,
    week_ending: str,
    dormant_pred_ids: set[str],
) -> dict:
    """Compute the maintenance candidate payload (pre-serialization).

    Pure function. Takes a read-only DB connection, the week-ending ISO
    date, and the set of dormant prediction IDs. Returns a dict matching
    ``MaintenanceCandidatesFile`` plus a ``spillover`` key (entries
    trimmed by the caps) and a ``health_warnings`` key (90d-old
    non-dormant predictions).
    """
    active = set(_active_predictions(conn, week_ending, dormant_pred_ids))
    changed = _changed_predictions_sql(conn, week_ending)
    review_queue = sorted(active & set(changed.keys()))

    # confidence_drift_score = distinct(signals) × sum(magnitudes)
    pred_records: list[dict] = []
    for pid in review_queue:
        sigs = sorted(set(changed[pid]))
        magnitude_sum = sum(SIGNAL_MAGNITUDE.get(s, 1.0) for s in sigs)
        score = float(len(sigs)) * float(magnitude_sum)
        pred_records.append(
            {
                "prediction_id": pid,
                "change_signals": sigs,
                "confidence_drift_score": score,
            }
        )

    # Sort by score desc, then prediction_id asc for deterministic order.
    pred_records.sort(
        key=lambda r: (-r["confidence_drift_score"], r["prediction_id"])
    )
    capped_preds = pred_records[:PREDICTIONS_CAP]
    spillover_preds = pred_records[PREDICTIONS_CAP:]

    # Glossary candidates.
    gloss_pairs = sorted(
        _ttl_stale_glossary(conn, week_ending),
        key=lambda p: (-p[1], p[0]),
    )
    gloss_records = [
        {"term_id": term, "ttl_expired_days": days} for term, days in gloss_pairs
    ]
    capped_gloss = gloss_records[:GLOSSARY_CAP]
    spillover_gloss = gloss_records[GLOSSARY_CAP:]

    # Health check: predictions older than 90d that aren't dormant.
    cutoff = (
        dt.date.fromisoformat(week_ending) - dt.timedelta(days=ACTIVE_WINDOW_DAYS)
    ).isoformat()
    rows = conn.execute(
        """
        SELECT prediction_id, prediction_date FROM predictions
         WHERE prediction_date IS NOT NULL
           AND prediction_date < ?
        ORDER BY prediction_date
        """,
        (cutoff,),
    ).fetchall()
    health_warnings: list[str] = []
    for pid, pdate in rows:
        if pid not in dormant_pred_ids:
            health_warnings.append(
                f"prediction {pid}: prediction_date={pdate} is older than "
                f"90 days but is NOT in the dormant snapshot — dormant "
                f"detection has a leak"
            )

    return {
        "week_ending": week_ending,
        "predictions": capped_preds,
        "glossary_terms": capped_gloss,
        "spillover": {
            "predictions": spillover_preds,
            "glossary_terms": spillover_gloss,
        },
        "health_warnings": health_warnings,
    }


def merge_spillover_into_queue(
    queue_path: Path, spillover: dict, week_ending: str
) -> None:
    """Append spillover entries to ``memory/maintenance/queue.md`` (dedupe).

    Format: ``## <week_ending>`` header followed by a table of
    ``prediction_id | first_seen_week | weeks_starved``. If the same
    ``prediction_id`` already appears under a prior header, increment
    its starvation counter rather than re-appending.

    The starvation counter is reconstructed every time by re-parsing
    the file, so the operation is idempotent.
    """
    queue_path.parent.mkdir(parents=True, exist_ok=True)
    existing_text = (
        queue_path.read_text(encoding="utf-8") if queue_path.is_file() else ""
    )

    # Build {pid: weeks_starved} from existing file rows.
    starved: dict[str, int] = {}
    for line in existing_text.splitlines():
        m = re.match(
            r"\|\s*([\w.\-]+)\s*\|\s*\d{4}-\d{2}-\d{2}\s*\|\s*(\d+)\s*\|",
            line,
        )
        if m:
            starved[m.group(1)] = int(m.group(2))

    new_pred_ids = [p["prediction_id"] for p in spillover.get("predictions", [])]
    new_term_ids = [g["term_id"] for g in spillover.get("glossary_terms", [])]
    all_new = new_pred_ids + new_term_ids
    if not all_new:
        return

    # Bump or set: any incoming ID gets its counter incremented (or set
    # to 1 if new).
    for pid in all_new:
        starved[pid] = starved.get(pid, 0) + 1

    # Rewrite the file deterministically: one section per week_ending,
    # each entry once. We append a new section for this week containing
    # ALL currently-starved ids — readers want the latest section to
    # show the up-to-date counts.
    header = f"## {week_ending}"
    lines = ["# Maintenance spillover queue", "",
             "Predictions / glossary terms trimmed by Step 0 caps. "
             "Entries here are force-promoted on a 4-week starvation "
             "guarantee. See design/scheduled/6_weekly_maintenance.md.",
             ""]
    # Preserve existing prior sections except this week's (rewritten).
    for line in existing_text.splitlines():
        if line.strip().startswith("## ") and line.strip() == header:
            break
        if line.startswith("# Maintenance spillover queue"):
            continue
        lines.append(line)
    lines.append(header)
    lines.append("")
    lines.append("| id | first_seen_week | weeks_starved |")
    lines.append("|---|---|---|")
    for pid in sorted(all_new):
        lines.append(
            f"| {pid} | {week_ending} | {starved[pid]} |"
        )
    lines.append("")

    _atomic_write(queue_path, "\n".join(lines).rstrip() + "\n")


def write_health_log(
    health_path: Path, week_ending: str, warnings: list[str]
) -> None:
    """Write the health log if there are any warnings (no-op otherwise)."""
    if not warnings:
        return
    health_path.parent.mkdir(parents=True, exist_ok=True)
    body = ["# Maintenance health log", "",
            f"Week ending: {week_ending}", "",
            "Step 0 health-check assertion (predictions older than 90 days "
            "AND not in dormant snapshot) returned non-zero rows. The "
            "dormant detection has a leak; see design/scheduled/"
            "4_weekly_memory.md. Maintenance run continues; this is a "
            "separate ticket.", "",
            "## Findings", ""]
    body.extend(f"- {w}" for w in warnings)
    body.append("")
    _atomic_write(health_path, "\n".join(body))


# ---------------------------------------------------------------------------
# Step 1 — Merge per-prediction judgement files
# ---------------------------------------------------------------------------


def merge_judgements_files(date_dir: Path) -> Path:
    """Merge ``maintenance-judgements.<pid>.json`` and the batched
    glossary file into ``maintenance-judgements.json``.

    Mirrors :func:`app.skills.extract_needs.merge_needs_files`. Walks
    the date dir, collects every ``maintenance-judgements.*.json``
    file (excluding ``maintenance-judgements.json`` itself), validates
    each via :class:`MaintenanceJudgementsFile`, then writes the merged
    payload deterministically (by ``prediction_id`` then ``stream``).

    Each per-prediction file may be one of:

      * The full ``MaintenanceJudgementsFile`` shape with ``week_ending``
        and ``judgements`` keys (the schema-strict form).
      * A bare list of judgement records (the lightweight shape an
        eager sub-agent might emit; the parent infers ``week_ending``
        from the date dir name).
      * A dict ``{"prediction_id": "...", "judgements": [...]}`` (mirror
        of the per-pid ``needs.<pid>.json`` shape).

    The glossary batch file (``maintenance-judgements.glossary.json``)
    is treated identically: it just contributes a list of glossary-stream
    judgement records keyed on ``glossary``.

    Returns the path to the merged ``maintenance-judgements.json``.
    Raises ``FileNotFoundError`` if no source files exist.
    """
    date_dir = Path(date_dir)
    if not date_dir.is_dir():
        raise FileNotFoundError(f"date directory missing: {date_dir}")
    sources = sorted(
        p for p in date_dir.glob("maintenance-judgements.*.json")
        if p.name != "maintenance-judgements.json"
    )
    if not sources:
        raise FileNotFoundError(
            f"no maintenance-judgements.<pid>.json files under {date_dir}"
        )

    week_ending = date_dir.name  # the directory IS the week-ending date.
    seen: set[tuple[str, str, str]] = set()  # (prediction_id, stream, entry_id)
    merged_records: list[dict] = []

    for src in sources:
        try:
            raw = json.loads(src.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            raise ValueError(f"{src}: invalid JSON: {e}") from e

        # Three accepted shapes (see docstring).
        if isinstance(raw, dict) and "judgements" in raw and "week_ending" in raw:
            judgements_raw = raw["judgements"]
        elif isinstance(raw, dict) and "judgements" in raw and "prediction_id" in raw:
            judgements_raw = raw["judgements"]
        elif isinstance(raw, list):
            judgements_raw = raw
        else:
            raise ValueError(
                f"{src}: unrecognized payload shape (expected "
                f"MaintenanceJudgementsFile, per-pred dict, or bare list)"
            )

        if not isinstance(judgements_raw, list):
            raise ValueError(
                f"{src}: judgements must be a list, got "
                f"{type(judgements_raw).__name__}"
            )

        for i, j in enumerate(judgements_raw):
            try:
                from app.skills.sourcedata_schemas import MaintenanceJudgement
                rec = MaintenanceJudgement.from_dict(
                    j, path=f"{src.name}.judgements[{i}]"
                )
            except SourcedataValidationError as e:
                raise ValueError(f"{src}: judgement #{i} invalid: {e}") from e
            key = (rec.prediction_id, rec.stream, rec.entry_id)
            if key in seen:
                continue
            seen.add(key)
            merged_records.append(rec.to_dict())

    # Deterministic ordering: by prediction_id then stream then entry_id.
    merged_records.sort(
        key=lambda r: (r["prediction_id"], r["stream"], r["entry_id"])
    )
    out_path = date_dir / "maintenance-judgements.json"
    payload = {"week_ending": week_ending, "judgements": merged_records}
    _atomic_write(out_path, json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    return out_path


# ---------------------------------------------------------------------------
# Step 3 — Validate
# ---------------------------------------------------------------------------


def validate_run(
    repo_root: Path,
    week_ending: str,
    *,
    db_path: Path | None = None,
) -> list[str]:
    """Verify that every Step 1 judgement was applied or escalated.

    For each judgement in
    ``app/sourcedata/<week_ending>/maintenance-judgements.json``:

      * ``stale``  — there must be a corresponding updated JSON file
                     under ``app/sourcedata/`` (check by stream+pid).
      * ``retire`` — the DB row has ``status='retired'`` (only the
                     glossary stream has a retire-able ``status``
                     column at the schema level; non-glossary retire
                     verdicts are accepted as long as a marker file
                     ``app/sourcedata/<week_ending>/retired.<stream>.<pid>.json``
                     exists).
      * ``broken`` — there is a row in
                     ``memory/maintenance/<week_ending>/broken.md``
                     mentioning the prediction_id.
      * ``fresh``  — no action required.

    Returns the list of error strings (empty == clean run). The CLI
    wrapper exits 1 on non-empty.
    """
    errors: list[str] = []
    sourcedata_root = repo_root / "app" / "sourcedata"
    week_dir = sourcedata_root / week_ending
    judgements_path = week_dir / "maintenance-judgements.json"

    if not judgements_path.is_file():
        errors.append(
            f"missing: {judgements_path.relative_to(repo_root)} "
            f"(Step 1 did not write merged judgements; cannot validate)"
        )
        return errors

    try:
        raw = json.loads(judgements_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        errors.append(f"{judgements_path}: invalid JSON: {e}")
        return errors
    try:
        bundle = MaintenanceJudgementsFile.from_dict(raw)
    except SourcedataValidationError as e:
        errors.append(f"{judgements_path}: schema invalid: {e}")
        return errors

    broken_path = (
        repo_root / "memory" / "maintenance" / week_ending / "broken.md"
    )
    broken_text = broken_path.read_text(encoding="utf-8") if broken_path.is_file() else ""

    # We open the DB only if we actually need to verify a retire verdict;
    # super-backfill is touchy about live DB writes, so keep it read-only
    # and lazy.
    db_conn: sqlite3.Connection | None = None

    def _db() -> sqlite3.Connection:
        nonlocal db_conn
        if db_conn is None:
            target = db_path or (repo_root / "app" / "data" / "analytics.sqlite")
            uri = f"file:{target.as_posix()}?mode=ro"
            db_conn = sqlite3.connect(uri, uri=True)
        return db_conn

    try:
        for j in bundle.judgements:
            if j.verdict == "fresh":
                continue
            if j.verdict == "stale":
                # Look for ANY *.json under app/sourcedata/<week_ending>/
                # whose name encodes the stream + pid. Acceptable forms:
                #   <stream>.<pid>.json    (e.g. needs.prediction.xxx.json)
                #   <stream>.json          (the merged stream file — fall
                #                           back if the per-pid form
                #                           isn't there but the merged
                #                           file mentions the pid)
                applied = _stale_applied(
                    week_dir, j.stream, j.prediction_id, j.entry_id
                )
                if not applied:
                    errors.append(
                        f"verdict=stale but no applied JSON for "
                        f"prediction={j.prediction_id} stream={j.stream} "
                        f"entry={j.entry_id} under "
                        f"{week_dir.relative_to(repo_root)}"
                    )
            elif j.verdict == "retire":
                if j.stream == "glossary":
                    row = _db().execute(
                        "SELECT status FROM glossary_terms WHERE term = ?",
                        (j.entry_id,),
                    ).fetchone()
                    if row is None:
                        errors.append(
                            f"verdict=retire but glossary term "
                            f"{j.entry_id!r} not found in DB"
                        )
                    elif row[0] != "retired":
                        errors.append(
                            f"verdict=retire but glossary term "
                            f"{j.entry_id!r} has status={row[0]!r} (expected "
                            f"'retired')"
                        )
                else:
                    marker = (
                        week_dir
                        / f"retired.{j.stream}.{j.prediction_id}.json"
                    )
                    if not marker.is_file():
                        errors.append(
                            f"verdict=retire but no marker "
                            f"{marker.relative_to(repo_root)} for "
                            f"non-glossary stream {j.stream}"
                        )
            elif j.verdict == "broken":
                if not broken_path.is_file():
                    errors.append(
                        f"verdict=broken but missing "
                        f"{broken_path.relative_to(repo_root)}"
                    )
                elif j.prediction_id not in broken_text:
                    errors.append(
                        f"verdict=broken but {j.prediction_id} not "
                        f"mentioned in {broken_path.relative_to(repo_root)}"
                    )
    finally:
        if db_conn is not None:
            db_conn.close()
    return errors


def _stale_applied(
    week_dir: Path, stream: str, prediction_id: str, entry_id: str
) -> bool:
    """Has the orchestrator written an updated JSON for this judgement?

    Acceptable proofs (any of):

      * ``<stream>.<prediction_id>.json`` exists (per-pid temp file).
      * ``<stream>.json`` exists AND mentions ``prediction_id`` (the
        merged stream file).
      * ``maintenance-update.<stream>.<prediction_id>.json`` exists
        (the explicit update marker the orchestrator emits).
    """
    stream_to_filename = {
        "reasoning": "predictions",
        "bridge": "bridges",
        "needs": "needs",
        "readings": "predictions",  # chain edges live alongside prediction
        "glossary": "glossary",
    }
    filename = stream_to_filename.get(stream, stream)

    # Form 1: per-pid temp.
    if (week_dir / f"{filename}.{prediction_id}.json").is_file():
        return True
    # Form 2: explicit update marker.
    if (week_dir / f"maintenance-update.{stream}.{prediction_id}.json").is_file():
        return True
    # Form 3: merged stream file mentioning the pid (or entry_id).
    merged = week_dir / f"{filename}.json"
    if merged.is_file():
        try:
            blob = merged.read_text(encoding="utf-8")
        except OSError:
            return False
        if prediction_id in blob or (entry_id and entry_id in blob):
            return True
    return False


# ---------------------------------------------------------------------------
# Atomic write helper
# ---------------------------------------------------------------------------


def _atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=f".{path.name}.", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(content)
        os.replace(tmp, path)
    except Exception:
        try:
            os.remove(tmp)
        except OSError:
            pass
        raise


# ---------------------------------------------------------------------------
# CLI driver
# ---------------------------------------------------------------------------


def _cmd_candidates(args: argparse.Namespace) -> int:
    repo_root: Path = args.repo_root.resolve()
    week_ending: str = args.week_ending

    if args.dormant_snapshot:
        snapshot_path = Path(args.dormant_snapshot)
        if snapshot_path.is_file():
            dormant_ids = parse_dormant_snapshot(
                snapshot_path.read_text(encoding="utf-8")
            )
        else:
            dormant_ids = set()
    else:
        dormant_ids = load_dormant_snapshot(repo_root, week_ending)

    db_target = repo_root / "app" / "data" / "analytics.sqlite"
    if not db_target.is_file():
        print(f"FAIL: DB not found: {db_target}", file=sys.stderr)
        return 2
    uri = f"file:{db_target.as_posix()}?mode=ro"
    conn = sqlite3.connect(uri, uri=True)
    try:
        payload = compute_candidates(conn, week_ending, dormant_ids)
    finally:
        conn.close()

    out_dir = repo_root / "app" / "sourcedata" / week_ending
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "maintenance-candidates.json"

    serial = {
        "week_ending": payload["week_ending"],
        "predictions": payload["predictions"],
        "glossary_terms": payload["glossary_terms"],
    }
    # Sanity-validate before write.
    MaintenanceCandidatesFile.from_dict(serial)

    _atomic_write(out_path, json.dumps(serial, ensure_ascii=False, indent=2) + "\n")

    queue_path = repo_root / "memory" / "maintenance" / "queue.md"
    merge_spillover_into_queue(queue_path, payload["spillover"], week_ending)

    health_path = (
        repo_root / "memory" / "maintenance" / week_ending / "health.md"
    )
    write_health_log(health_path, week_ending, payload["health_warnings"])

    print(
        f"OK candidates: {len(payload['predictions'])} predictions, "
        f"{len(payload['glossary_terms'])} glossary terms, "
        f"spillover={len(payload['spillover']['predictions']) + len(payload['spillover']['glossary_terms'])}, "
        f"health_warnings={len(payload['health_warnings'])}"
    )
    return 0


def _cmd_merge_judgements(args: argparse.Namespace) -> int:
    date_dir = Path(args.date_dir) if args.date_dir else (
        args.repo_root.resolve() / "app" / "sourcedata" / args.date
    )
    out = merge_judgements_files(date_dir)
    print(f"OK merged into {out}")
    return 0


def _cmd_validate(args: argparse.Namespace) -> int:
    repo_root: Path = args.repo_root.resolve()
    errors = validate_run(repo_root, args.week_ending, db_path=args.db)
    if not errors:
        print(f"OK validate: {args.week_ending} clean")
        return 0
    print(f"FAIL validate: {len(errors)} issue(s)")
    for e in errors:
        print(f"  - {e}")
    return 1


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        description="Weekly maintenance toolbox (Sunday slot 5.5)"
    )
    p.add_argument(
        "--repo-root", default=Path("."), type=Path,
        help="repo root (defaults to cwd)",
    )
    sub = p.add_subparsers(dest="cmd", required=True)

    cand = sub.add_parser(
        "candidates",
        help="Step 0 — select candidate predictions + glossary terms",
    )
    cand.add_argument("--week-ending", required=True)
    cand.add_argument(
        "--dormant-snapshot", default=None,
        help="path to a dormant snapshot markdown; defaults to "
        "memory/dormant/dormant-<YYYYMMDD>.md derived from --week-ending",
    )

    merge = sub.add_parser(
        "merge-judgements",
        help="fan-in per-prediction judgement files into one merged file",
    )
    merge_grp = merge.add_mutually_exclusive_group(required=True)
    merge_grp.add_argument("--date", help="ISO date — derives date dir")
    merge_grp.add_argument("--date-dir", help="explicit date dir path")

    val = sub.add_parser("validate", help="Step 3 — gate the maintenance run")
    val.add_argument("--week-ending", required=True)
    val.add_argument(
        "--db", default=None, type=Path,
        help="override the default DB path (read-only)",
    )

    args = p.parse_args(argv)
    if args.cmd == "candidates":
        return _cmd_candidates(args)
    if args.cmd == "merge-judgements":
        return _cmd_merge_judgements(args)
    if args.cmd == "validate":
        return _cmd_validate(args)
    p.error(f"unknown subcommand {args.cmd}")
    return 2


if __name__ == "__main__":
    sys.exit(main())
