"""Persist LLM-extracted Needs + 5W1H tasks for a prediction.

Spec: ``design/skills/extract-needs.md``.

Pure persistence layer. The LLM call lives in the orchestrator; this
module reads the resulting JSON list and writes the rows.

A "Need" captures *what the prediction needs from its driver coalition*
to land — i.e. who's pushing the world toward the predicted state and
the 5W1H breakdown of their task. (Originally named JTBD; renamed
because "Jobs-To-Be-Done" framed the actor as someone who reacts after
landing, opposite of the system's intent.)

Phase 3 output relocation:

  Per-prediction temp files now live under
  ``app/sourcedata/<date>/needs.<pid>.json``. After all per-prediction
  sub-agents finish, :func:`merge_needs_files` deterministically merges
  them into the canonical ``app/sourcedata/<date>/needs.json``
  (consumed by ``ingest_sourcedata`` and the renderer flow). The legacy
  ``.jtbd-tmp/today-needs-pred-*.json`` files are NOT deleted in
  Phase 3 — Phase 4's backfill migrates them. Phase 3 only stops
  writing new ones there.

JSON shape (each item):
    {
      "actor": "...",
      "job": "...",
      "outcome": "...",
      "motivation": "...",
      "task": {
        "who": "...", "what": "...", "where": "...",
        "when": "...", "why": "...", "how": null
      }
    }
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import sqlite3
import sys
from pathlib import Path

from app.src.timewindow import parse_time_window


def _hash_id(prefix: str, *parts: str) -> str:
    h = hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()
    return f"{prefix}.{h[:16]}"


def _is_complete_5w1h(task: dict) -> bool:
    return all((task or {}).get(k) for k in ("who", "what", "where", "when", "why"))


def commit_need(
    conn: sqlite3.Connection,
    *,
    prediction_id: str,
    need_records: list[dict],
) -> dict:
    """Insert Need + 5W1H task rows. Returns a summary dict.

    Phase 4a: each record may carry locale siblings (`actor_ja`, `job_ja`,
    `task.who_ja`, etc.). Missing locale keys default to NULL → frontend
    falls back to canonical EN.
    """
    today = dt.date.today().isoformat()
    summary = {
        "prediction_id": prediction_id,
        "need_count": 0,
        "tasks_count": 0,
        "blocked": [],
    }
    for rec in need_records:
        actor = (rec or {}).get("actor")
        if not actor:
            continue
        need_id = _hash_id("need", prediction_id, actor)
        task = rec.get("task") or {}
        # Phase 3 structured time bounds. The runway window for the
        # task lives in `task.when` as freeform text; parse it into
        # ISO start/end (NULL when unparseable). The Need's window
        # equals the union of its tasks' windows — extract-needs
        # currently emits exactly one task per Need, so the union
        # collapses to that single task's window. (See
        # design/FIXME.md "need.target_*_date never populated".)
        task_start, task_end = parse_time_window(task.get("when") or "")
        conn.execute(
            """
            INSERT OR REPLACE INTO prediction_needs
              (need_id, prediction_id,
               actor, actor_ja, actor_es, actor_fil,
               job, job_ja, job_es, job_fil,
               outcome, outcome_ja, outcome_es, outcome_fil,
               motivation, motivation_ja, motivation_es, motivation_fil,
               target_start_date, target_end_date,
               reviewed_by_human, updated_at)
            VALUES (?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?,
                    0, ?)
            """,
            (
                need_id, prediction_id,
                actor, rec.get("actor_ja"), rec.get("actor_es"), rec.get("actor_fil"),
                rec.get("job", ""), rec.get("job_ja"), rec.get("job_es"), rec.get("job_fil"),
                rec.get("outcome"), rec.get("outcome_ja"), rec.get("outcome_es"), rec.get("outcome_fil"),
                rec.get("motivation"), rec.get("motivation_ja"), rec.get("motivation_es"), rec.get("motivation_fil"),
                task_start, task_end,
                today,
            ),
        )
        summary["need_count"] += 1
        task_id = _hash_id("need_task", need_id, task.get("what", ""))
        status = "open" if _is_complete_5w1h(task) else "blocked"
        if status == "blocked":
            summary["blocked"].append(task_id)
        cells = ("who", "what", "where", "when", "why", "how")
        col_names: list[str] = []
        col_values: list = []
        for cell in cells:
            for suffix, key in (
                ("", cell),
                ("_ja", f"{cell}_ja"),
                ("_es", f"{cell}_es"),
                ("_fil", f"{cell}_fil"),
            ):
                col_names.append(f"{cell}_text{suffix}")
                col_values.append(task.get(key))
        col_names.extend(("target_start_date", "target_end_date"))
        col_values.extend((task_start, task_end))
        # Total columns: task_id + need_id + cell cols + 2 target cols + status + updated_at
        placeholders = ", ".join(["?"] * (2 + len(col_names) + 2))
        conn.execute(
            f"""
            INSERT OR REPLACE INTO needs_tasks
              (task_id, need_id, {', '.join(col_names)}, status, updated_at)
            VALUES ({placeholders})
            """,
            (task_id, need_id, *col_values, status, today),
        )
        summary["tasks_count"] += 1
    conn.commit()
    return summary


def merge_needs_files(date_dir: Path) -> Path:
    """Merge ``needs.<pid>.json`` per-prediction files into ``needs.json``.

    Spec: ``design/skills/extract-needs.md`` (Phase 3 output relocation).

    Walks ``<date_dir>/needs.*.json`` and combines them into a single
    ``<date_dir>/needs.json`` matching the ``NeedsFile`` schema:

        {
          "date": "<YYYY-MM-DD inferred from date_dir.name>",
          "by_prediction": {
            "<prediction_id>": [<need records>],
            ...
          }
        }

    Each per-prediction file is one of:

      * A bare list of need records (the on-disk shape used by the CLI).
        The prediction id is taken from the filename (``needs.<pid>.json``).
      * A dict ``{"prediction_id": "...", "needs": [...]}`` (the shape
        a sub-agent emits when it wants to be explicit).

    Deterministic ordering: per-prediction keys sorted by id; per-need
    rows preserved in source order so the writer's intent stays intact.

    Returns the path to the merged ``needs.json``. Raises
    ``FileNotFoundError`` if no source files exist (the orchestrator
    should not call merge before any sub-agent has written).
    """
    date_dir = Path(date_dir)
    if not date_dir.is_dir():
        raise FileNotFoundError(f"date directory missing: {date_dir}")
    sources = sorted(p for p in date_dir.glob("needs.*.json")
                     if p.name != "needs.json")
    if not sources:
        raise FileNotFoundError(
            f"no needs.<pid>.json files under {date_dir}"
        )
    by_pred: dict[str, list[dict]] = {}
    for src in sources:
        try:
            raw = json.loads(src.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            raise ValueError(f"{src}: invalid JSON: {e}") from e
        if isinstance(raw, dict) and "prediction_id" in raw and "needs" in raw:
            pid = str(raw["prediction_id"])
            needs_list = raw["needs"]
        else:
            # Bare list shape; derive prediction id from filename.
            #   needs.prediction.adb89416691d7587.json
            #   -> "prediction.adb89416691d7587"
            stem = src.stem  # e.g. "needs.prediction.adb89416691d7587"
            if not stem.startswith("needs."):
                raise ValueError(
                    f"{src}: filename does not start with 'needs.'"
                )
            pid = stem[len("needs."):]
            needs_list = raw
        if not isinstance(needs_list, list):
            raise ValueError(
                f"{src}: needs payload must be a list, got "
                f"{type(needs_list).__name__}"
            )
        # Preserve source order; later sources for the same pid append.
        by_pred.setdefault(pid, []).extend(needs_list)

    merged = {
        "date": date_dir.name,
        "by_prediction": {pid: by_pred[pid] for pid in sorted(by_pred)},
    }
    out = date_dir / "needs.json"
    # Atomic write so a crashed merge never leaves a half-written file.
    import os
    import tempfile

    fd, tmp = tempfile.mkstemp(prefix="needs.json.", dir=str(date_dir))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(merged, f, ensure_ascii=False, indent=2)
            f.write("\n")
        os.replace(tmp, out)
    except Exception:
        try:
            os.remove(tmp)
        except OSError:
            pass
        raise
    return out


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        description="Persist LLM-extracted Need records for a prediction"
    )
    sub = p.add_subparsers(dest="cmd")

    # Default subcommand-less form (the existing CLI).
    p.add_argument("--db", type=Path)
    p.add_argument("--prediction-id")
    p.add_argument("--needs-json-file", type=Path,
                   help="Path to a JSON file containing a list of Need records.")

    # `merge` subcommand: combine per-prediction temp files into needs.json.
    merge_p = sub.add_parser(
        "merge",
        help="Merge needs.<pid>.json files into needs.json under a date dir",
    )
    merge_p.add_argument("--date-dir", required=True, type=Path)

    args = p.parse_args(argv)

    if args.cmd == "merge":
        out = merge_needs_files(args.date_dir)
        print(f"OK merged into {out}")
        return 0

    # Default: persist a single per-prediction file into the DB.
    if not args.db or not args.prediction_id or not args.needs_json_file:
        p.error(
            "--db, --prediction-id, and --needs-json-file are required "
            "(or use the `merge` subcommand)."
        )
    if not args.db.is_file():
        print(f"FAIL DB not found: {args.db}", file=sys.stderr)
        return 2
    if not args.needs_json_file.is_file():
        print(f"FAIL Needs JSON not found: {args.needs_json_file}", file=sys.stderr)
        return 2
    try:
        records = json.loads(args.needs_json_file.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"FAIL invalid JSON: {e}", file=sys.stderr)
        return 2
    if not isinstance(records, list):
        print("FAIL Needs JSON must be a list", file=sys.stderr)
        return 2
    conn = sqlite3.connect(args.db)
    try:
        summary = commit_need(conn, prediction_id=args.prediction_id,
                              need_records=records)
    finally:
        conn.close()
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
