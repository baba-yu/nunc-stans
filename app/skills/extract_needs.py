"""Persist LLM-extracted Needs + 5W1H tasks for a prediction (Stream E).

Spec: ``design/skills/extract-needs.md``.

Pure persistence layer. The LLM call lives in the orchestrator; this
module reads the resulting JSON list and writes the rows.

A "Need" captures *what the prediction needs from its driver coalition*
to land — i.e. who's pushing the world toward the predicted state and
the 5W1H breakdown of their task. (Originally named JTBD; renamed
because "Jobs-To-Be-Done" framed the actor as someone who reacts after
landing, opposite of the system's intent.)

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


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        description="Persist LLM-extracted Need records for a prediction"
    )
    p.add_argument("--db", required=True, type=Path)
    p.add_argument("--prediction-id", required=True)
    p.add_argument("--needs-json-file", required=True, type=Path,
                   help="Path to a JSON file containing a list of Need records.")
    args = p.parse_args(argv)
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
