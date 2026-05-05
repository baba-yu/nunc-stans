"""Promote glossary candidates to active (glossary stream — Phase 1).

Reads the SQLite `glossary_terms` table and applies the promotion rule:

    candidate → active   when distinct_days_14d >= 3
    active    → retired  when occurrences_30d == 0 AND last_seen older than 30 days

Definitions for newly-promoted active rows must be filled by the
writer's LLM context inside `1_daily_update`. This skill exposes
`pending_definitions()` so the orchestrator can hand the list to the
LLM as a structured input. When invoked with `--mode auto` it just
flips the status flag; the orchestrator fills in `one_liner_eli14`
and `why_it_matters` afterward and calls `commit_definition()` to
persist them.

Skill spec: `design/skills/define-glossary-terms.md`.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sqlite3
import sys
from pathlib import Path


PROMOTE_THRESHOLD_DAYS_14D = 3
RETIRE_AFTER_DAYS_QUIET = 30


def promote_eligible(conn: sqlite3.Connection, today: str) -> list[dict]:
    """Flip candidate→active for any term that hits the threshold.

    Returns the list of newly promoted rows (caller fills definitions).
    """
    cur = conn.execute(
        """
        SELECT term, distinct_days_14d, occurrences_30d
          FROM glossary_terms
         WHERE status = 'candidate'
           AND distinct_days_14d >= ?
        """,
        (PROMOTE_THRESHOLD_DAYS_14D,),
    )
    eligible = [dict(r) for r in cur.fetchall()]
    for row in eligible:
        conn.execute(
            """
            UPDATE glossary_terms
               SET status = 'active', updated_at = ?
             WHERE term = ?
            """,
            (today, row["term"]),
        )
    conn.commit()
    return eligible


def retire_quiet(conn: sqlite3.Connection, today: str) -> list[dict]:
    """Flip active→retired for terms with no recent occurrences."""
    cur = conn.execute(
        """
        SELECT term, last_seen_date
          FROM glossary_terms
         WHERE status = 'active'
           AND reviewed_by_human = 0
           AND occurrences_30d = 0
           AND (last_seen_date IS NULL OR last_seen_date < date(?, '-30 days'))
        """,
        (today,),
    )
    rows = [dict(r) for r in cur.fetchall()]
    for r in rows:
        conn.execute(
            "UPDATE glossary_terms SET status='retired', updated_at=? WHERE term=?",
            (today, r["term"]),
        )
    conn.commit()
    return rows


def pending_definitions(conn: sqlite3.Connection) -> list[dict]:
    """Active rows that still need an LLM-generated definition pass.

    These are typically rows that promoted from candidate→active in
    today's run, plus older rows that never had a definition filled in.
    """
    cur = conn.execute(
        """
        SELECT term, aliases_json, occurrences_30d, distinct_days_14d
          FROM glossary_terms
         WHERE status = 'active'
           AND (one_liner_eli14 IS NULL OR one_liner_eli14 = '')
        """,
    )
    return [dict(r) for r in cur.fetchall()]


def commit_definition(
    conn: sqlite3.Connection,
    term: str,
    one_liner_eli14: str,
    why_it_matters: str,
    canonical_link: str | None = None,
    reviewed_by_human: bool = False,
) -> None:
    today = dt.date.today().isoformat()
    conn.execute(
        """
        UPDATE glossary_terms
           SET one_liner_eli14   = ?,
               why_it_matters    = ?,
               canonical_link    = COALESCE(?, canonical_link),
               reviewed_by_human = COALESCE(?, reviewed_by_human),
               updated_at        = ?
         WHERE term = ?
        """,
        (
            one_liner_eli14,
            why_it_matters,
            canonical_link,
            1 if reviewed_by_human else None,
            today,
            term,
        ),
    )
    conn.commit()


def run(db_path: Path, mode: str) -> dict:
    if not db_path.is_file():
        raise FileNotFoundError(f"DB not found: {db_path}")
    today = dt.date.today().isoformat()
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    promoted = promote_eligible(conn, today)
    retired = retire_quiet(conn, today)
    pending = pending_definitions(conn)
    conn.close()
    return {
        "today": today,
        "mode": mode,
        "promoted_count": len(promoted),
        "promoted": [r["term"] for r in promoted],
        "retired_count": len(retired),
        "retired": [r["term"] for r in retired],
        "pending_definitions_count": len(pending),
        "pending_definitions": [r["term"] for r in pending],
    }


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Promote glossary candidates to active")
    p.add_argument("--db", required=True, type=Path)
    p.add_argument("--mode", choices=["auto", "report-only"], default="auto",
                   help="`auto` flips status; `report-only` prints the would-be list without changes")
    args = p.parse_args(argv)
    if args.mode == "report-only":
        # Open read-only-ish: do a dry-run by hitting a copy.
        import shutil, tempfile
        tmp = Path(tempfile.mkdtemp()) / "glossary-dryrun.sqlite"
        shutil.copy2(args.db, tmp)
        summary = run(tmp, args.mode)
    else:
        try:
            summary = run(args.db, args.mode)
        except FileNotFoundError as e:
            print(f"FAIL {e}", file=sys.stderr)
            return 2
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
