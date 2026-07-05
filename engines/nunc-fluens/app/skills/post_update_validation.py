"""Post-update validation: DB + JSON-export shape gate for daily flows.

Spec: ``design/skills/post-update-validation.md``.

Runs after the writer + ingest + extract-needs + locale-fanout + export
chain. Verifies that every column the dashboard needs for a given date
is actually populated, in every locale, with no silent NULLs.

Three check sets, selectable from the CLI:

  * ``--check news``          — after ``1_daily_update`` finishes:
    today's ``predictions`` rows exist with full title / reasoning / mid-tier + every
    locale fan-out + target_*_date; today's ``prediction_needs`` +
    ``needs_tasks`` rows exist with full 5W1H + every locale fan-out.

  * ``--check future-prediction`` — after ``2_future_prediction``
    finishes: today's ``validation_rows`` rows exist with bridge_text +
    every locale fan-out + valid ``support_dimension``.

  * ``--check exports`` — after ``run_update_pages`` (i.e. export.py)
    finishes: each new prediction's
    ``docs/data/nodes/prediction-<pid>.json`` carries ``title_locales``,
    ``reasoning_locales``, and (if needs/bridges exist) the matching
    ``*_locales`` dicts on every nested record.

  * ``--check all`` runs every set in sequence.

Exits 0 on full pass, 1 on any failure. Prints one OK / FAIL line per
check group, plus indented per-row detail on failures.

This is the *runtime* gate that PHASE4A-LOCALE-AUDIT.md tracks at
*spec*-time. Wire it in at the end of the daily orchestrators so a
silent locale drop never reaches the dashboard.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sqlite3
import sys
from pathlib import Path

from app.src.timewindow import parse_time_window

LOCALES = ("ja", "es", "fil")

# ---------------------------------------------------------------------------
# Predictions
# ---------------------------------------------------------------------------

# (column-name, "must be non-empty"): canonical EN columns the writer
# emits for every title / reasoning / mid-tier prediction. The parser silently drops
# partial blocks, so a NULL here means the writer's output didn't match
# the spec for this row.
EN_PREDICTION_COLS = (
    "title",
    "reasoning_because",
    "reasoning_given",
    "reasoning_so_that",
    "reasoning_landing",
    "plain_language",
    "summary",
)

# Locale-fanned-out siblings — every EN column above gets `_<locale>`
# variants populated by ingest from the JA/ES/FIL sibling news files.
LOCALE_PREDICTION_COLS = tuple(
    f"{c}_{loc}" for c in EN_PREDICTION_COLS for loc in LOCALES
)

# Target dates derived from reasoning_landing by app/src/timewindow.py.
# A NULL here means the parser didn't find a parseable time expression.
TARGET_PREDICTION_COLS = ("target_start_date", "target_end_date")


def _check_predictions_for_date(conn: sqlite3.Connection, date: str) -> list[str]:
    cur = conn.execute(
        f"""
        SELECT prediction_id, source_row_index,
               {', '.join(EN_PREDICTION_COLS)},
               {', '.join(LOCALE_PREDICTION_COLS)},
               {', '.join(TARGET_PREDICTION_COLS)}
        FROM predictions
        WHERE prediction_date = ?
        ORDER BY source_row_index
        """,
        (date,),
    )
    rows = cur.fetchall()
    cols = [d[0] for d in cur.description]
    errs: list[str] = []
    if not rows:
        errs.append(
            f"no predictions rows for prediction_date={date!r} — writer + ingest "
            f"step never produced a row (check 1_daily_update Step 2 + ingest)"
        )
        return errs
    for row in rows:
        rec = dict(zip(cols, row))
        pid = rec["prediction_id"]
        idx = rec["source_row_index"]
        # EN canonical
        for col in EN_PREDICTION_COLS:
            v = rec.get(col)
            if v is None or (isinstance(v, str) and not v.strip()):
                errs.append(
                    f"prediction #{idx} ({pid}): {col} is NULL/empty — "
                    f"title / reasoning / mid-tier spec requires writer to emit this"
                )
        # Locale fan-out
        for col in LOCALE_PREDICTION_COLS:
            v = rec.get(col)
            if v is None or (isinstance(v, str) and not v.strip()):
                errs.append(
                    f"prediction #{idx} ({pid}): {col} is NULL/empty — "
                    f"locale-fanout did not write this column "
                    f"(check sibling locale news file + ingest "
                    f"_update_prediction_locale_cols)"
                )
        # Target dates from timewindow parser
        for col in TARGET_PREDICTION_COLS:
            v = rec.get(col)
            if v is None or (isinstance(v, str) and not v.strip()):
                errs.append(
                    f"prediction #{idx} ({pid}): {col} is NULL — timewindow "
                    f"parser couldn't extract from reasoning_landing="
                    f"{rec.get('reasoning_landing')!r:.80} "
                    f"(check app/src/timewindow.py patterns)"
                )
    return errs


# ---------------------------------------------------------------------------
# Needs + tasks (per prediction)
# ---------------------------------------------------------------------------

NEED_COLS = ("actor", "job", "outcome", "motivation")
NEED_LOCALE_COLS = tuple(f"{c}_{loc}" for c in NEED_COLS for loc in LOCALES)

# 5W1H cells on needs_tasks. "how" is allowed to be NULL by spec
# (extract-needs.md: "Acceptable to be `null` when the path is open").
TASK_REQUIRED_5W1H = ("who_text", "what_text", "where_text", "when_text", "why_text")
TASK_OPTIONAL_5W1H = ("how_text",)
TASK_LOCALE_REQUIRED = tuple(
    f"{c}_{loc}" for c in TASK_REQUIRED_5W1H for loc in LOCALES
)


def _check_needs_for_date(conn: sqlite3.Connection, date: str) -> list[str]:
    pred_ids = [
        r[0]
        for r in conn.execute(
            "SELECT prediction_id FROM predictions WHERE prediction_date = ?",
            (date,),
        )
    ]
    errs: list[str] = []
    if not pred_ids:
        errs.append(f"no predictions for {date}, can't check needs")
        return errs
    placeholders = ",".join("?" * len(pred_ids))
    cur = conn.execute(
        f"""
        SELECT n.prediction_id, n.need_id,
               n.actor, n.job, n.outcome, n.motivation,
               n.target_start_date AS need_target_start,
               n.target_end_date   AS need_target_end,
               {', '.join(f'n.{c}' for c in NEED_LOCALE_COLS)},
               t.task_id,
               {', '.join(f't.{c}' for c in TASK_REQUIRED_5W1H)},
               {', '.join(f't.{c}' for c in TASK_OPTIONAL_5W1H)},
               {', '.join(f't.{c}' for c in TASK_LOCALE_REQUIRED)},
               t.target_start_date AS task_target_start,
               t.target_end_date   AS task_target_end,
               t.status
        FROM prediction_needs n
        LEFT JOIN needs_tasks t ON t.need_id = n.need_id
        WHERE n.prediction_id IN ({placeholders})
        ORDER BY n.prediction_id, n.actor
        """,
        pred_ids,
    )
    rows = cur.fetchall()
    cols = [d[0] for d in cur.description]
    if not rows:
        errs.append(
            f"no prediction_needs rows for predictions on {date} — "
            f"extract-needs was not called or returned empty"
        )
        return errs
    seen_pids: set[str] = set()
    for row in rows:
        rec = dict(zip(cols, row))
        seen_pids.add(rec["prediction_id"])
        nid = rec["need_id"]
        actor = rec.get("actor", "")[:40] if rec.get("actor") else "?"
        # EN canonical Need fields
        for col in NEED_COLS:
            v = rec.get(col)
            if v is None or (isinstance(v, str) and not v.strip()):
                errs.append(
                    f"need {nid} ({actor!r}): {col} is NULL/empty — "
                    f"extract-needs JSON spec requires this"
                )
        # Locale Need fields
        for col in NEED_LOCALE_COLS:
            v = rec.get(col)
            if v is None or (isinstance(v, str) and not v.strip()):
                errs.append(
                    f"need {nid} ({actor!r}): {col} is NULL/empty — "
                    f"extract-needs locale fan-out missing"
                )
        # 5W1H + locales
        if rec.get("task_id") is None:
            errs.append(
                f"need {nid} ({actor!r}): no needs_tasks row — "
                f"extract-needs must always emit a task per need"
            )
            continue
        for col in TASK_REQUIRED_5W1H:
            v = rec.get(col)
            if v is None or (isinstance(v, str) and not v.strip()):
                errs.append(
                    f"task {rec['task_id']} ({actor!r}): 5W1H {col} is NULL/empty — "
                    f"extract-needs must emit all of who/what/where/when/why "
                    f"(how is the only nullable cell)"
                )
        for col in TASK_LOCALE_REQUIRED:
            v = rec.get(col)
            if v is None or (isinstance(v, str) and not v.strip()):
                errs.append(
                    f"task {rec['task_id']} ({actor!r}): locale {col} is NULL/empty"
                )
        # Phase 3: structured time window. When the writer's free-text
        # `when_text` is parseable by app/src/timewindow.py, the
        # `target_start_date` / `target_end_date` columns must be filled
        # on both the task row and the parent need row. NULL on a
        # parseable string means commit_need skipped the parser — see
        # design/FIXME.md "need.target_*_date never populated".
        when_text = rec.get("when_text") or ""
        parse_start, parse_end = parse_time_window(when_text)
        if parse_start and parse_end:
            for col, want in (
                ("task_target_start", parse_start),
                ("task_target_end", parse_end),
                ("need_target_start", parse_start),
                ("need_target_end", parse_end),
            ):
                v = rec.get(col)
                if v is None or (isinstance(v, str) and not v.strip()):
                    where = "needs_tasks" if col.startswith("task_") else "prediction_needs"
                    errs.append(
                        f"task {rec['task_id']} ({actor!r}): {where}.{col[5:] if col.startswith('task_') else col[5:]} "
                        f"is NULL but when_text={when_text!r:.60} parses to {want} — "
                        f"commit_need must call timewindow.parse_time_window "
                        f"(check app/skills/extract_needs.py)"
                    )
    missing_pids = set(pred_ids) - seen_pids
    for pid in sorted(missing_pids):
        errs.append(f"prediction {pid}: zero prediction_needs rows attached")
    return errs


# ---------------------------------------------------------------------------
# Validation rows (FP file)
# ---------------------------------------------------------------------------

VR_REQUIRED = ("bridge_text",)
VR_LOCALE = tuple(f"bridge_text_{loc}" for loc in LOCALES)
VR_DIM_VALID = ("because", "given", "so_that", "landing", "none")


def _check_validation_rows_for_date(
    conn: sqlite3.Connection, date: str
) -> list[str]:
    cur = conn.execute(
        f"""
        SELECT validation_row_id, prediction_id, support_dimension,
               {', '.join(VR_REQUIRED)},
               {', '.join(VR_LOCALE)}
        FROM validation_rows
        WHERE validation_date = ?
        ORDER BY validation_row_id
        """,
        (date,),
    )
    rows = cur.fetchall()
    cols = [d[0] for d in cur.description]
    errs: list[str] = []
    if not rows:
        errs.append(
            f"no validation_rows for validation_date={date!r} — "
            f"check 2_future_prediction Step 4 + ingest"
        )
        return errs
    for row in rows:
        rec = dict(zip(cols, row))
        vrid = rec["validation_row_id"]
        for col in VR_REQUIRED:
            v = rec.get(col)
            if v is None or (isinstance(v, str) and not v.strip()):
                errs.append(
                    f"validation_row {vrid}: {col} is NULL/empty — "
                    f"writer's ## Bridge paragraph not parsed"
                )
        for col in VR_LOCALE:
            v = rec.get(col)
            if v is None or (isinstance(v, str) and not v.strip()):
                errs.append(
                    f"validation_row {vrid}: {col} is NULL/empty — "
                    f"locale-fanout did not write this column "
                    f"(check sibling locale FP file)"
                )
        sd = rec.get("support_dimension")
        if sd is None or sd not in VR_DIM_VALID:
            errs.append(
                f"validation_row {vrid}: support_dimension={sd!r} not in "
                f"{VR_DIM_VALID} — bridge body missing the dimension keyword"
            )
    return errs


# ---------------------------------------------------------------------------
# JSON exports
# ---------------------------------------------------------------------------


def _load_prediction_nodes(docs_data_dir: Path) -> dict[str, tuple[Path, dict]]:
    """Walk ``docs/data/graph-*.json`` and index prediction nodes by ID.

    The same prediction appears in graph-mix plus the scope-specific
    graph (graph-tech / graph-business). Either copy is identical for
    locale-bag purposes, so we keep the first one we find. Returns
    ``{prediction_id: (source_path, node_dict)}``.
    """
    out: dict[str, tuple[Path, dict]] = {}
    for path in sorted(docs_data_dir.glob("graph-*.json")):
        try:
            d = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            continue
        for node in d.get("nodes") or []:
            nid = node.get("id") or ""
            if nid.startswith("prediction.") and nid not in out:
                out[nid] = (path, node)
    return out


def _check_json_exports_for_date(
    docs_data_dir: Path, conn: sqlite3.Connection, date: str
) -> list[str]:
    errs: list[str] = []
    pred_ids = [
        r[0]
        for r in conn.execute(
            "SELECT prediction_id FROM predictions WHERE prediction_date = ?",
            (date,),
        )
    ]
    if not pred_ids:
        errs.append(f"no predictions for {date}, can't check exports")
        return errs
    if not docs_data_dir.is_dir():
        errs.append(f"docs/data dir missing: {docs_data_dir}")
        return errs
    index = _load_prediction_nodes(docs_data_dir)
    if not index:
        errs.append(
            f"no prediction nodes found across docs/data/graph-*.json — "
            f"run `python -m app.src.cli export` first"
        )
        return errs
    for pid in pred_ids:
        if pid not in index:
            errs.append(
                f"export missing: prediction {pid} not in any docs/data/graph-*.json"
            )
            continue
        src, node = index[pid]
        tag = f"{src.name} / {pid}"
        # labels.title locale bag (the node-level title that nodeLabel(n,'title') reads)
        labels = (node.get("labels") or {})
        title_bag = labels.get("title")
        if not isinstance(title_bag, dict):
            errs.append(f"{tag}: labels.title is not a dict")
        else:
            for loc in ("en",) + LOCALES:
                if not title_bag.get(loc):
                    errs.append(f"{tag}: labels.title.{loc} is missing/empty")
        det = node.get("detail") or {}
        # detail.title_locales (mirror of labels.title — both should be
        # populated; renderer can read either.)
        tl = det.get("title_locales")
        if not isinstance(tl, dict):
            errs.append(f"{tag}: detail.title_locales missing or not dict")
        else:
            for loc in ("en",) + LOCALES:
                if not tl.get(loc):
                    errs.append(f"{tag}: detail.title_locales.{loc} empty")
        # detail.reasoning_locales
        rl = det.get("reasoning_locales")
        if not isinstance(rl, dict):
            errs.append(f"{tag}: detail.reasoning_locales missing or not dict")
        else:
            for key in ("because", "given", "so_that", "landing", "plain_language"):
                bag = rl.get(key)
                if not isinstance(bag, dict):
                    errs.append(
                        f"{tag}: detail.reasoning_locales.{key} missing/not dict"
                    )
                    continue
                for loc in ("en",) + LOCALES:
                    if not bag.get(loc):
                        errs.append(
                            f"{tag}: detail.reasoning_locales.{key}.{loc} empty"
                        )
        # detail.bridges (validation rows attached to this prediction);
        # locale-bag checked only if any bridges exist.
        bridges = det.get("bridges") or []
        for i, b in enumerate(bridges):
            bl = b.get("text_locales")
            if not isinstance(bl, dict):
                errs.append(f"{tag}: detail.bridges[{i}].text_locales missing")
                continue
            for loc in ("en",) + LOCALES:
                if not bl.get(loc):
                    errs.append(
                        f"{tag}: detail.bridges[{i}].text_locales.{loc} empty"
                    )
        # detail.needs (Need + 5W1H)
        needs = det.get("needs") or []
        for i, n in enumerate(needs):
            for key in ("actor_locales", "job_locales", "outcome_locales",
                        "motivation_locales"):
                bag = n.get(key)
                if not isinstance(bag, dict):
                    errs.append(f"{tag}: detail.needs[{i}].{key} missing")
                    continue
                for loc in ("en",) + LOCALES:
                    if not bag.get(loc):
                        errs.append(
                            f"{tag}: detail.needs[{i}].{key}.{loc} empty"
                        )
            t = n.get("task")
            if not isinstance(t, dict):
                errs.append(f"{tag}: detail.needs[{i}].task missing")
                continue
            for cell in ("who", "what", "where", "when", "why"):
                bag = t.get(f"{cell}_locales")
                if not isinstance(bag, dict):
                    errs.append(
                        f"{tag}: detail.needs[{i}].task.{cell}_locales missing"
                    )
                    continue
                for loc in ("en",) + LOCALES:
                    if not bag.get(loc):
                        errs.append(
                            f"{tag}: detail.needs[{i}].task.{cell}_locales.{loc} empty"
                        )
    return errs


# ---------------------------------------------------------------------------
# File-level locale fan-out check
# ---------------------------------------------------------------------------


def _check_locale_files_exist(
    base: Path, kind: str, date: str
) -> list[str]:
    """Confirm all 4 locale siblings exist for the given kind on `date`."""
    errs: list[str] = []
    stem = f"news-{date.replace('-', '')}" if kind == "news" else (
        f"future-prediction-{date.replace('-', '')}"
    )
    sub = "report" if kind == "news" else "future-prediction"
    for loc in ("en",) + LOCALES:
        p = base / sub / loc / f"{stem}.md"
        if not p.is_file():
            errs.append(f"missing: {p}")
        elif p.stat().st_size == 0:
            errs.append(f"empty: {p}")
    return errs


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------


def _run_check(name: str, errs: list[str]) -> bool:
    if errs:
        print(f"FAIL {name}: {len(errs)} issue(s)")
        for e in errs:
            print(f"  - {e}")
        return False
    print(f"OK {name}")
    return True


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        description="Post-update DB + JSON-export validation gate"
    )
    p.add_argument(
        "--check", required=True,
        choices=("news", "future-prediction", "exports", "all"),
        help="which check set to run"
    )
    p.add_argument(
        "--date", default=dt.date.today().isoformat(),
        help="ISO date to validate (default: today)"
    )
    p.add_argument(
        "--db", default=Path("app/data/analytics.sqlite"), type=Path,
        help="path to the analytics SQLite DB"
    )
    p.add_argument(
        "--docs-data-dir", default=Path("docs/data"), type=Path,
        help="path to docs/data/ for the JSON-export checks"
    )
    p.add_argument(
        "--repo-root", default=Path("."), type=Path,
        help="repo root (used to locate report/ + future-prediction/ trees)"
    )
    args = p.parse_args(argv)

    if not args.db.is_file():
        print(f"FAIL: DB not found: {args.db}", file=sys.stderr)
        return 2

    conn = sqlite3.connect(args.db)
    conn.row_factory = sqlite3.Row
    all_pass = True
    try:
        if args.check in ("news", "all"):
            all_pass &= _run_check(
                f"locale files (news, {args.date})",
                _check_locale_files_exist(args.repo_root, "news", args.date),
            )
            all_pass &= _run_check(
                f"predictions schema ({args.date})",
                _check_predictions_for_date(conn, args.date),
            )
            all_pass &= _run_check(
                f"needs + 5W1H ({args.date})",
                _check_needs_for_date(conn, args.date),
            )
        if args.check in ("future-prediction", "all"):
            all_pass &= _run_check(
                f"locale files (future-prediction, {args.date})",
                _check_locale_files_exist(
                    args.repo_root, "future-prediction", args.date
                ),
            )
            all_pass &= _run_check(
                f"validation_rows schema ({args.date})",
                _check_validation_rows_for_date(conn, args.date),
            )
        if args.check in ("exports", "all"):
            all_pass &= _run_check(
                f"JSON exports ({args.date})",
                _check_json_exports_for_date(
                    args.docs_data_dir, conn, args.date
                ),
            )
    finally:
        conn.close()
    return 0 if all_pass else 1


if __name__ == "__main__":
    sys.exit(main())
