"""Deterministic ingester for ``app/sourcedata/<date>/*.json``.

Spec: ``design/sourcedata-layout.md §Migration phases — Phase 2``.

Reads the JSON sourcedata for a single date, validates each file against
its schema (``sourcedata_schemas.py``), and writes the structured rows
into the analytics SQLite DB. Reuses the existing helpers in
``app.src.ingest`` (``_upsert_prediction``, ``_upsert_assignment``,
``_pick_theme_per_scope``, ``_update_prediction_locale_cols``) so the
sourcedata path produces the same DB shape as the legacy markdown path.

Public API:

  * :func:`ingest_day` — base/EN ingest for a single date.
  * :func:`ingest_day_locales` — fan-in of ja/es/fil locale JSON files.
  * :func:`scan_dates` — list available date dirs under ``app/sourcedata/``.

The single field rename across the JSON ↔ DB boundary is
``reasoning.plain_language`` JSON ↔ ``predictions.eli14`` DB column.
Every other key maps by direct name.
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from app.src import ingest as _ingest
from app.skills.extract_needs import commit_need
from app.skills.sourcedata_schemas import (
    BridgesFile,
    ChangeLogFile,
    HeadlinesFile,
    NeedsFile,
    NewsSectionFile,
    PredictionsFile,
    SourcedataValidationError,
)


LOCALES = ("ja", "es", "fil")


# Per-connection cache of {date_iso: {json_prediction_id: db_prediction_id}}
# used to associate sibling needs/bridges/locale JSON files with the
# correct DB row. ``sqlite3.Connection`` rejects ``setattr`` for
# arbitrary attributes, so we key by ``id(conn)`` and clean up via
# weakref-style coverage (the dict entry is harmless if it leaks: the
# next ingest of the same date overwrites it).
_PID_BY_JSONID: dict[tuple[int, str], dict[str, str]] = {}


def _set_pid_map(
    conn: sqlite3.Connection, date_iso: str, m: dict[str, str]
) -> None:
    _PID_BY_JSONID[(id(conn), date_iso)] = m


def _get_pid_map(
    conn: sqlite3.Connection, date_iso: str
) -> dict[str, str]:
    return _PID_BY_JSONID.get((id(conn), date_iso), {})


# ---------------------------------------------------------------------------
# Path helpers
# ---------------------------------------------------------------------------


def sourcedata_root(repo_root: Path) -> Path:
    """Return ``<repo_root>/app/sourcedata``."""
    return Path(repo_root) / "app" / "sourcedata"


def date_dir(repo_root: Path, date_iso: str) -> Path:
    return sourcedata_root(repo_root) / date_iso


def locale_date_dir(repo_root: Path, date_iso: str, locale: str) -> Path:
    return sourcedata_root(repo_root) / "locales" / date_iso / locale


def scan_dates(repo_root: Path) -> list[str]:
    """Return ISO date stems for every date directory under ``app/sourcedata/``.

    Skips ``locales/`` (the locale fan-out subtree) and any non-date dir
    name like ``.gitkeep``. The returned list is sorted ascending so the
    caller iterates oldest-to-newest.
    """
    root = sourcedata_root(repo_root)
    if not root.is_dir():
        return []
    out: list[str] = []
    for child in sorted(root.iterdir()):
        if not child.is_dir():
            continue
        name = child.name
        if name == "locales":
            continue
        # Cheap shape check; full validation happens at JSON parse time.
        if len(name) == 10 and name[4] == "-" and name[7] == "-":
            out.append(name)
    return out


# ---------------------------------------------------------------------------
# JSON loaders
# ---------------------------------------------------------------------------


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _load_predictions(path: Path) -> PredictionsFile:
    return PredictionsFile.from_dict(_load_json(path))


def _load_needs(path: Path) -> NeedsFile:
    return NeedsFile.from_dict(_load_json(path))


def _load_bridges(path: Path) -> BridgesFile:
    return BridgesFile.from_dict(_load_json(path))


def _load_headlines(path: Path) -> HeadlinesFile:
    return HeadlinesFile.from_dict(_load_json(path))


def _load_change_log(path: Path) -> ChangeLogFile:
    return ChangeLogFile.from_dict(_load_json(path))


def _load_news_section(path: Path) -> NewsSectionFile:
    return NewsSectionFile.from_dict(_load_json(path))


# ---------------------------------------------------------------------------
# Source-file row for the JSON file
# ---------------------------------------------------------------------------


def _register_source_file(
    conn: sqlite3.Connection,
    *,
    repo_root: Path,
    json_path: Path,
    file_type: str,
    report_date: str,
    locale: str = "en",
) -> str:
    """Register a sourcedata JSON file in the ``source_files`` table.

    Mirrors :func:`app.src.ingest._upsert_source_file` but takes
    ``repo_root`` explicitly so tests can use a fake repo under
    ``tmp_path`` without polluting the real ``app/sourcedata/``. The
    JSON file is the canonical source for the rows it produces;
    provenance points back to the JSON, not to any markdown rendition
    that may be derived from it later.
    """
    import hashlib
    from datetime import datetime, timezone

    try:
        rel = str(Path(json_path).relative_to(Path(repo_root))).replace("\\", "/")
    except ValueError:
        # Path is outside the repo (e.g. an in-memory test path); fall
        # back to a stable absolute identifier.
        rel = str(Path(json_path)).replace("\\", "/")
    source_file_id = "source." + hashlib.sha1(
        ("||" + rel).encode("utf-8")
    ).hexdigest()[:16]
    content = Path(json_path).read_bytes().decode("utf-8", errors="replace")
    content_sha = hashlib.sha1(content.encode("utf-8")).hexdigest()
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    conn.execute(
        """
        INSERT INTO source_files (
          source_file_id, path, file_type, report_date,
          content_sha, parsed_at, locale
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(path) DO UPDATE SET
          report_date=excluded.report_date,
          content_sha=excluded.content_sha,
          parsed_at=excluded.parsed_at,
          locale=excluded.locale
        """,
        (source_file_id, rel, file_type, report_date, content_sha, now_iso, locale),
    )
    cur = conn.execute(
        "SELECT source_file_id FROM source_files WHERE path = ?", (rel,)
    )
    row = cur.fetchone()
    return row["source_file_id"] if row else source_file_id


# ---------------------------------------------------------------------------
# predictions.json -> predictions table
# ---------------------------------------------------------------------------


def _ingest_predictions_file(
    conn: sqlite3.Connection,
    *,
    repo_root: Path,
    date_iso: str,
    json_path: Path,
    themes: list[_ingest.ThemeRow],
) -> dict[int, str]:
    """Ingest ``predictions.json`` for ``date_iso``.

    Returns a map ``{source_row_index: prediction_id}`` so the caller
    (locale fan-in, needs ingest) can associate sibling JSON entries by
    position.
    """
    pf = _load_predictions(json_path)
    source_file_id = _register_source_file(
        conn,
        repo_root=repo_root,
        json_path=json_path,
        file_type="daily_report",
        report_date=pf.date,
    )
    # JSON-to-DB id map: spec uses external "prediction.<sha>" ids in
    # JSON, but the DB id is hashed from (date, prediction_summary=body)
    # by _upsert_prediction; we keep the JSON id only for round-trip
    # auditing and look up the DB id for needs/locale fan-in instead.
    pid_by_index: dict[int, str] = {}
    pid_by_jsonid: dict[str, str] = {}
    for idx, pred in enumerate(pf.predictions):
        prediction_id = _ingest._upsert_prediction(
            conn,
            prediction_summary=pred.body,
            short_label=pred.title,
            prediction_date=pf.date,
            source_file_id=source_file_id,
            source_row_index=idx,
            raw_text=pred.body,
            title=pred.title,
            reasoning_because=pred.reasoning.because,
            reasoning_given=pred.reasoning.given,
            reasoning_so_that=pred.reasoning.so_that,
            reasoning_landing=pred.reasoning.landing,
            # The single JSON ↔ DB rename: plain_language → eli14.
            eli14=pred.reasoning.plain_language,
            summary_text=pred.summary,
        )
        pid_by_index[idx] = prediction_id
        pid_by_jsonid[pred.id] = prediction_id
        # Theme assignment per scope, identical to legacy markdown path.
        match_by_scope = _ingest._pick_theme_per_scope(pred.body, themes)
        for scope_id in ("tech", "business"):
            theme = match_by_scope.get(scope_id)
            if theme is not None:
                _ingest._upsert_assignment(
                    conn,
                    prediction_id=prediction_id,
                    scope_id=scope_id,
                    category_id=theme.category_id,
                    theme_id=theme.theme_id,
                    subtheme_id=None,
                    method="anchor",
                    score=1.0,
                )
            else:
                _ingest._upsert_candidate(
                    conn,
                    scope_id=scope_id,
                    prediction_id=prediction_id,
                    label=pred.title,
                    short_label=pred.title,
                    description=pred.body[:280],
                )
    # Stash the JSON-id map for later locale/needs use within the same
    # connection (avoids re-loading + re-validating the same file in a
    # single ingest). Keyed by id(conn) since sqlite3.Connection
    # rejects setattr.
    _set_pid_map(conn, date_iso, pid_by_jsonid)
    return pid_by_index


# ---------------------------------------------------------------------------
# needs.json -> prediction_needs + needs_tasks
# ---------------------------------------------------------------------------


def _ingest_needs_file(
    conn: sqlite3.Connection,
    *,
    date_iso: str,
    json_path: Path,
) -> int:
    """Ingest ``needs.json`` for ``date_iso``. Returns total need count."""
    nf = _load_needs(json_path)
    pid_by_jsonid: dict[str, str] = _get_pid_map(conn, date_iso)
    total = 0
    for json_pid, needs in nf.by_prediction.items():
        # Resolve JSON-id back to DB prediction_id when possible; fall
        # back to using the JSON id directly (allows hand-written needs
        # for predictions whose row already lives in the DB and whose
        # id happens to match).
        db_pid = pid_by_jsonid.get(json_pid, json_pid)
        records: list[dict] = []
        for n in needs:
            rec: dict = {"actor": n.actor, "job": n.job}
            if n.outcome is not None:
                rec["outcome"] = n.outcome
            if n.motivation is not None:
                rec["motivation"] = n.motivation
            if n.task is not None:
                rec["task"] = {
                    "who": n.task.who,
                    "what": n.task.what,
                    "where": n.task.where,
                    "when": n.task.when,
                    "why": n.task.why,
                    "how": n.task.how,
                }
            records.append(rec)
        summary = commit_need(conn, prediction_id=db_pid, need_records=records)
        total += summary["need_count"]
    return total


# ---------------------------------------------------------------------------
# bridges.json -> validation_rows
# ---------------------------------------------------------------------------


def _ingest_bridges_file(
    conn: sqlite3.Connection,
    *,
    repo_root: Path,
    date_iso: str,
    json_path: Path,
) -> int:
    """Ingest ``bridges.json`` for ``date_iso``. Returns row count."""
    bf = _load_bridges(json_path)
    source_file_id = _register_source_file(
        conn,
        repo_root=repo_root,
        json_path=json_path,
        file_type="future_prediction_report",
        report_date=bf.date,
    )
    from app.src.parsers.prediction_parser import EvidenceItem, ValidationRow

    pid_by_jsonid: dict[str, str] = _get_pid_map(conn, date_iso)
    count = 0
    for entry in bf.validation_rows:
        # Map JSON id back to a DB prediction id when we can; otherwise
        # leave it as the JSON id (the legacy ingest also creates
        # placeholder rows when the prediction can't be matched, but
        # for sourcedata the JSON is authoritative — the writer is
        # expected to have produced predictions.json on the same day or
        # to reference an existing prediction by hashed id).
        prediction_id = pid_by_jsonid.get(
            entry.prediction_ref.id, entry.prediction_ref.id
        )
        row = ValidationRow(
            prediction_summary=entry.prediction_ref.short_label,
            prediction_date=entry.prediction_ref.prediction_date,
            related_items_text=entry.evidence_summary,
            reference_links=[
                EvidenceItem(url=ref.url, title=ref.label)
                for ref in entry.reference_links
            ],
            observed_relevance=entry.today_relevance,
            raw_row_markdown=entry.bridge.narrative,
            bridge_text=entry.bridge.narrative,
            support_dimension=entry.bridge.support_dimension,
        )
        _ingest._upsert_validation_row(
            conn,
            source_file_id=source_file_id,
            validation_date=bf.date,
            prediction_id=prediction_id,
            row=row,
        )
        count += 1
    return count


# ---------------------------------------------------------------------------
# headlines / change_log / news_section
# ---------------------------------------------------------------------------
#
# These three streams currently have no dedicated DB tables — they're
# rendered straight into markdown by the writer. Phase 2 just validates
# their shape so a later phase (renderer) can rely on them. We register
# the source_file row for provenance and return the parsed counts.


def _ingest_headlines_file(
    conn: sqlite3.Connection,
    *,
    repo_root: Path,
    json_path: Path,
) -> int:
    hf = _load_headlines(json_path)
    _register_source_file(
        conn,
        repo_root=repo_root,
        json_path=json_path,
        file_type="other",
        report_date=hf.date,
    )
    return len(hf.technical) + len(hf.plain)


def _ingest_change_log_file(
    conn: sqlite3.Connection,
    *,
    repo_root: Path,
    json_path: Path,
) -> int:
    cl = _load_change_log(json_path)
    _register_source_file(
        conn,
        repo_root=repo_root,
        json_path=json_path,
        file_type="other",
        report_date=cl.date,
    )
    return len(cl.items)


def _ingest_news_section_file(
    conn: sqlite3.Connection,
    *,
    repo_root: Path,
    json_path: Path,
) -> int:
    ns = _load_news_section(json_path)
    _register_source_file(
        conn,
        repo_root=repo_root,
        json_path=json_path,
        file_type="other",
        report_date=ns.date,
    )
    return sum(len(s.bullets) for s in ns.sections)


# ---------------------------------------------------------------------------
# Locale fan-in
# ---------------------------------------------------------------------------


def _ingest_locale_predictions(
    conn: sqlite3.Connection,
    *,
    date_iso: str,
    json_path: Path,
    locale: str,
) -> int:
    """Fill ``predictions._<locale>`` columns from a locale JSON file.

    The locale file mirrors the EN ``predictions.json`` shape; we map
    by source_row_index (position in the array) into the canonical EN
    prediction row, then call
    :func:`app.src.ingest._update_prediction_locale_cols`.
    """
    pf = _load_predictions(json_path)
    pid_by_jsonid: dict[str, str] = _get_pid_map(conn, date_iso)
    # If the EN ingest wasn't run in this connection (e.g. re-ingest of
    # a previously-loaded day), fall back to looking up by date.
    if not pid_by_jsonid:
        cur = conn.execute(
            "SELECT prediction_id, source_row_index FROM predictions "
            "WHERE prediction_date = ? ORDER BY source_row_index",
            (pf.date,),
        )
        rows = cur.fetchall()
        idx_to_pid = {r["source_row_index"]: r["prediction_id"] for r in rows}
    else:
        idx_to_pid = {}
        # The pid_by_jsonid dict was populated in EN ingest order, so we
        # don't have direct positional access; pull source_row_index from
        # the DB.
        for json_id, pid in pid_by_jsonid.items():
            cur = conn.execute(
                "SELECT source_row_index FROM predictions WHERE prediction_id = ?",
                (pid,),
            )
            r = cur.fetchone()
            if r is not None:
                idx_to_pid[r["source_row_index"]] = pid
    count = 0
    for idx, pred in enumerate(pf.predictions):
        target_pid = idx_to_pid.get(idx)
        if target_pid is None:
            continue
        _ingest._update_prediction_locale_cols(
            conn,
            prediction_id=target_pid,
            locale=locale,
            summary=pred.body,
            short_label=pred.title,
            summary_text=pred.summary,
            title=pred.title,
            reasoning_because=pred.reasoning.because,
            reasoning_given=pred.reasoning.given,
            reasoning_so_that=pred.reasoning.so_that,
            reasoning_landing=pred.reasoning.landing,
            eli14=pred.reasoning.plain_language,
        )
        count += 1
    return count


def _ingest_locale_needs(
    conn: sqlite3.Connection,
    *,
    date_iso: str,
    json_path: Path,
    locale: str,
) -> int:
    """Fill locale columns on ``prediction_needs`` + ``needs_tasks``.

    Locale needs files mirror the canonical EN shape. We match by the
    JSON prediction id (same id as the EN file used) and within each
    prediction by the actor field — the actor is the natural key.
    """
    nf = _load_needs(json_path)
    pid_by_jsonid: dict[str, str] = _get_pid_map(conn, date_iso)
    if not pid_by_jsonid:
        return 0
    count = 0
    for json_pid, needs in nf.by_prediction.items():
        db_pid = pid_by_jsonid.get(json_pid, json_pid)
        # Pull the existing EN need rows for this prediction so we can
        # match by actor.
        cur = conn.execute(
            "SELECT need_id, actor FROM prediction_needs WHERE prediction_id = ?",
            (db_pid,),
        )
        existing = {r["actor"]: r["need_id"] for r in cur.fetchall()}
        for n in needs:
            need_id = existing.get(n.actor)
            if need_id is None:
                # No matching EN need; skip rather than silently invent
                # one (extract-needs is the canonical source of needs).
                continue
            conn.execute(
                f"""
                UPDATE prediction_needs SET
                  actor_{locale}      = ?,
                  job_{locale}        = ?,
                  outcome_{locale}    = COALESCE(?, outcome_{locale}),
                  motivation_{locale} = COALESCE(?, motivation_{locale})
                WHERE need_id = ?
                """,
                (n.actor, n.job, n.outcome, n.motivation, need_id),
            )
            if n.task is not None:
                # Pull the EN task row so we can update by task_id.
                tcur = conn.execute(
                    "SELECT task_id FROM needs_tasks WHERE need_id = ?",
                    (need_id,),
                )
                trow = tcur.fetchone()
                if trow is not None:
                    cells = ("who", "what", "where", "when", "why", "how")
                    sets = ", ".join(
                        f"{c}_text_{locale} = COALESCE(?, {c}_text_{locale})"
                        for c in cells
                    )
                    args = [getattr(n.task, c) for c in cells]
                    args.append(trow["task_id"])
                    conn.execute(
                        f"UPDATE needs_tasks SET {sets} WHERE task_id = ?",
                        args,
                    )
            count += 1
    return count


def _ingest_locale_bridges(
    conn: sqlite3.Connection,
    *,
    date_iso: str,
    json_path: Path,
    locale: str,
) -> int:
    """Fill ``validation_rows.bridge_text_<locale>`` from a locale JSON file.

    Match by index (position in the validation_rows array within the
    JSON) against the canonical EN rows for the same date. Mirrors the
    legacy ``_ingest_localized_validation_group`` index-match approach.
    """
    bf = _load_bridges(json_path)
    cur = conn.execute(
        """
        SELECT vr.validation_row_id
        FROM validation_rows vr
        JOIN source_files sf ON vr.source_file_id = sf.source_file_id
        WHERE vr.validation_date = ?
        ORDER BY vr.rowid
        """,
        (bf.date,),
    )
    canon_row_ids = [r["validation_row_id"] for r in cur.fetchall()]
    count = 0
    for idx, entry in enumerate(bf.validation_rows):
        if idx >= len(canon_row_ids):
            break
        sum_col = f"prediction_summary_{locale}"
        bridge_col = f"bridge_text_{locale}"
        conn.execute(
            f"UPDATE validation_rows SET {sum_col} = ?, "
            f"{bridge_col} = COALESCE(?, {bridge_col}) "
            f"WHERE validation_row_id = ?",
            (
                entry.prediction_ref.short_label,
                entry.bridge.narrative,
                canon_row_ids[idx],
            ),
        )
        count += 1
    return count


# ---------------------------------------------------------------------------
# Public entry points
# ---------------------------------------------------------------------------


def ingest_day(
    conn: sqlite3.Connection,
    repo_root: Path,
    date_iso: str,
) -> dict:
    """Ingest every JSON file under ``app/sourcedata/<date_iso>/``.

    Idempotent: re-running with the same JSON files produces the same
    DB rows. The ingest order is fixed:

      1. predictions.json  (creates predictions; needed by needs/bridges)
      2. needs.json
      3. bridges.json
      4. headlines.json
      5. change_log.json
      6. news_section.json

    Files that don't exist are silently skipped — sourcedata may be
    populated stream-by-stream during the daily flow. Schema-validation
    errors propagate (fail-fast).
    """
    repo_root = Path(repo_root)
    summary: dict = {
        "date": date_iso,
        "predictions": 0,
        "needs": 0,
        "bridges": 0,
        "headlines": 0,
        "change_log": 0,
        "news_section": 0,
    }
    base = date_dir(repo_root, date_iso)
    if not base.is_dir():
        return summary

    # Themes are needed for scope assignment; load once.
    themes = _ingest._load_themes(conn)

    pred_path = base / "predictions.json"
    if pred_path.is_file():
        pid_map = _ingest_predictions_file(
            conn,
            repo_root=repo_root,
            date_iso=date_iso,
            json_path=pred_path,
            themes=themes,
        )
        summary["predictions"] = len(pid_map)

    needs_path = base / "needs.json"
    if needs_path.is_file():
        summary["needs"] = _ingest_needs_file(
            conn, date_iso=date_iso, json_path=needs_path
        )

    bridges_path = base / "bridges.json"
    if bridges_path.is_file():
        summary["bridges"] = _ingest_bridges_file(
            conn,
            repo_root=repo_root,
            date_iso=date_iso,
            json_path=bridges_path,
        )

    headlines_path = base / "headlines.json"
    if headlines_path.is_file():
        summary["headlines"] = _ingest_headlines_file(
            conn, repo_root=repo_root, json_path=headlines_path
        )

    change_log_path = base / "change_log.json"
    if change_log_path.is_file():
        summary["change_log"] = _ingest_change_log_file(
            conn, repo_root=repo_root, json_path=change_log_path
        )

    news_section_path = base / "news_section.json"
    if news_section_path.is_file():
        summary["news_section"] = _ingest_news_section_file(
            conn, repo_root=repo_root, json_path=news_section_path
        )

    conn.commit()
    return summary


def ingest_day_locales(
    conn: sqlite3.Connection,
    repo_root: Path,
    date_iso: str,
) -> dict:
    """Fan-in locale JSON files for ``date_iso``.

    Reads ``app/sourcedata/locales/<date_iso>/<L>/*.json`` for each
    locale in {ja, es, fil} and fills the ``_<locale>`` columns on the
    EN-canonical rows that :func:`ingest_day` previously created.
    """
    repo_root = Path(repo_root)
    summary: dict = {"date": date_iso}
    for loc in LOCALES:
        loc_summary = {
            "predictions": 0,
            "needs": 0,
            "bridges": 0,
        }
        base = locale_date_dir(repo_root, date_iso, loc)
        if not base.is_dir():
            summary[loc] = loc_summary
            continue
        pred_path = base / "predictions.json"
        if pred_path.is_file():
            loc_summary["predictions"] = _ingest_locale_predictions(
                conn, date_iso=date_iso, json_path=pred_path, locale=loc
            )
        needs_path = base / "needs.json"
        if needs_path.is_file():
            loc_summary["needs"] = _ingest_locale_needs(
                conn, date_iso=date_iso, json_path=needs_path, locale=loc
            )
        bridges_path = base / "bridges.json"
        if bridges_path.is_file():
            loc_summary["bridges"] = _ingest_locale_bridges(
                conn, date_iso=date_iso, json_path=bridges_path, locale=loc
            )
        summary[loc] = loc_summary
    conn.commit()
    return summary


# Re-export for callers that prefer to import the validation error from
# this module (so they don't need to know the schemas module exists).
__all__ = (
    "SourcedataValidationError",
    "ingest_day",
    "ingest_day_locales",
    "scan_dates",
    "sourcedata_root",
    "date_dir",
    "locale_date_dir",
)
