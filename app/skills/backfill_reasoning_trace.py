"""Backfill Stream C reasoning trace + Stream J title for legacy predictions.

Skill spec: `design/skills/backfill-reasoning-trace.md`.

The Python side is *deterministic state management* only:
- `list_candidates` returns predictions whose `reasoning_because` is NULL,
  along with the raw_text that the writer's LLM context will summarize.
- `commit_backfill` upserts the LLM-extracted fields, using COALESCE so a
  null field never blanks a previously-written value.

The actual LLM call lives in the daily orchestrator (or a one-shot backfill
runner). This module is what that orchestrator imports.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sqlite3
import sys
from pathlib import Path


def list_candidates(conn: sqlite3.Connection, *, limit: int = 25) -> list[dict]:
    """Return up to `limit` predictions that need a backfill.

    A row is a candidate when *any* of: title, the 5 Stream C reasoning
    fields, or the Stream K mid-tier summary is NULL. The LLM extraction
    pass can then fill all missing fields in one shot.
    """
    cur = conn.execute(
        """
        SELECT prediction_id, prediction_summary, prediction_date,
               source_row_index, raw_text, title, summary
          FROM predictions
         WHERE reasoning_because IS NULL
            OR reasoning_given   IS NULL
            OR reasoning_so_that IS NULL
            OR reasoning_landing IS NULL
            OR eli14             IS NULL
            OR title             IS NULL
            OR summary           IS NULL
         ORDER BY prediction_date DESC, source_row_index ASC
         LIMIT ?
        """,
        (limit,),
    )
    out = []
    for row in cur.fetchall():
        out.append(
            {
                "prediction_id": row["prediction_id"],
                "prediction_summary": row["prediction_summary"],
                "prediction_date": row["prediction_date"],
                "source_row_index": row["source_row_index"],
                "raw_text": row["raw_text"] or "",
                "title": row["title"],
                "summary": row["summary"],
            }
        )
    return out


def commit_backfill(
    conn: sqlite3.Connection,
    *,
    prediction_id: str,
    title: str | None = None,
    reasoning_because: str | None = None,
    reasoning_given: str | None = None,
    reasoning_so_that: str | None = None,
    reasoning_landing: str | None = None,
    eli14: str | None = None,
    summary: str | None = None,
    summary_ja: str | None = None,
    summary_es: str | None = None,
    summary_fil: str | None = None,
) -> None:
    """Persist the LLM-extracted fields. NULL inputs leave the column
    alone (COALESCE pattern). Stream K mid-tier `summary` and its 3
    locale fan-outs are included so a single backfill pass can cover
    title + Stream C + Stream K all at once."""
    today = dt.date.today().isoformat()
    conn.execute(
        """
        UPDATE predictions
           SET title             = COALESCE(?, title),
               reasoning_because = COALESCE(?, reasoning_because),
               reasoning_given   = COALESCE(?, reasoning_given),
               reasoning_so_that = COALESCE(?, reasoning_so_that),
               reasoning_landing = COALESCE(?, reasoning_landing),
               eli14             = COALESCE(?, eli14),
               summary           = COALESCE(?, summary),
               summary_ja        = COALESCE(?, summary_ja),
               summary_es        = COALESCE(?, summary_es),
               summary_fil       = COALESCE(?, summary_fil),
               updated_at        = ?
         WHERE prediction_id = ?
        """,
        (
            title,
            reasoning_because,
            reasoning_given,
            reasoning_so_that,
            reasoning_landing,
            eli14,
            summary,
            summary_ja,
            summary_es,
            summary_fil,
            today,
            prediction_id,
        ),
    )
    conn.commit()


def run(db_path: Path, *, limit: int, dry_run: bool) -> dict:
    if not db_path.is_file():
        raise FileNotFoundError(f"DB not found: {db_path}")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    candidates = list_candidates(conn, limit=limit)
    summary = {
        "candidate_count": len(candidates),
        "dry_run": dry_run,
        "candidates": [
            {
                "prediction_id": c["prediction_id"],
                "prediction_date": c["prediction_date"],
                "source_row_index": c["source_row_index"],
                "raw_text_preview": (c["raw_text"][:120] + "…") if c["raw_text"] else "",
                "title": c["title"],
            }
            for c in candidates
        ],
    }
    conn.close()
    return summary


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="List backfill candidates for Stream C reasoning trace + Stream J title")
    p.add_argument("--db", required=True, type=Path)
    p.add_argument("--limit", type=int, default=25)
    p.add_argument("--dry-run", action="store_true",
                   help="List candidates but don't open them for LLM extraction")
    args = p.parse_args(argv)
    try:
        summary = run(args.db, limit=args.limit, dry_run=args.dry_run)
    except FileNotFoundError as e:
        print(f"FAIL {e}", file=sys.stderr)
        return 2
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
