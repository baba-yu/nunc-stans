"""Backfill prediction short_label fields without the parser's old
40-char hard cap. One-shot companion to
``news_parser._derive_short_label`` after that helper stopped
truncating.

For every prediction row, re-derive ``prediction_short_label`` (and the
JA / ES / FIL siblings) from the matching ``prediction_summary*``
column. Only rows whose stored value is missing or ends in an ellipsis
are rewritten — hand-edited short labels pass through untouched.

Usage:
    python -m app.skills.backfill_short_labels [--dry-run]

Without ``--dry-run`` the script commits to the configured analytics
DB.
"""

from __future__ import annotations

import argparse
import sqlite3
import sys
from pathlib import Path

# Allow running as ``python -m app.skills.backfill_short_labels`` from the
# repo root. The skills directory isn't a package its parent makes
# importable, so prepend the repo root to sys.path.
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import re

from app.src.db import connect
from app.src.parsers.news_parser import _derive_short_label


# (short_label_col, summary_col) per locale we maintain on `predictions`.
LOCALE_PAIRS: tuple[tuple[str, str], ...] = (
    ("prediction_short_label",     "prediction_summary"),
    ("prediction_short_label_ja",  "prediction_summary_ja"),
    ("prediction_short_label_es",  "prediction_summary_es"),
    ("prediction_short_label_fil", "prediction_summary_fil"),
)


# Match the parser's BOLD_RE so the backfill feeds _derive_short_label
# the same `**bold title**` hint the live ingest path does. Without this
# the helper sees a markdown-wrapped paragraph and returns the whole thing.
_BOLD_RE = re.compile(r"\*\*([^*]+)\*\*")


def _bold_hint(summary: str | None) -> str | None:
    if not summary:
        return None
    m = _BOLD_RE.search(summary)
    return m.group(1).strip() if m else None


def _is_truncated(value: str | None) -> bool:
    """True when the stored short_label looks parser-truncated."""
    if not value:
        return False
    v = value.rstrip()
    return v.endswith("…") or v.endswith("...")


def backfill(conn: sqlite3.Connection, *, dry_run: bool = False) -> dict:
    cols = ["prediction_id"] + [c for pair in LOCALE_PAIRS for c in pair]
    cur = conn.execute(f"SELECT {', '.join(cols)} FROM predictions")
    rows = cur.fetchall()
    rows_updated = 0
    rows_skipped = 0
    fields_changed = 0
    for row in rows:
        sets: list[str] = []
        params: list[str] = []
        for short_col, sum_col in LOCALE_PAIRS:
            short = row[short_col]
            summary = row[sum_col]
            if not summary:
                # No locale-specific summary to derive from — skip.
                continue
            # Skip rows whose stored value is already a clean (non-truncated)
            # short label; treat hand edits as authoritative.
            if short and not _is_truncated(short):
                continue
            new_short = _derive_short_label(summary, _bold_hint(summary), 0)
            if not new_short or new_short == short:
                continue
            sets.append(f"{short_col} = ?")
            params.append(new_short)
        if sets:
            rows_updated += 1
            fields_changed += len(sets)
            if not dry_run:
                params.append(row["prediction_id"])
                conn.execute(
                    f"UPDATE predictions SET {', '.join(sets)} WHERE prediction_id = ?",
                    params,
                )
        else:
            rows_skipped += 1
    if not dry_run:
        conn.commit()
    return {
        "rows_total":     len(rows),
        "rows_updated":   rows_updated,
        "rows_skipped":   rows_skipped,
        "fields_changed": fields_changed,
        "dry_run":        dry_run,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true",
                        help="report stats without committing")
    args = parser.parse_args()

    conn = connect()
    try:
        stats = backfill(conn, dry_run=args.dry_run)
    finally:
        conn.close()

    print(
        f"backfill_short_labels: total={stats['rows_total']} "
        f"updated={stats['rows_updated']} fields_changed={stats['fields_changed']} "
        f"skipped={stats['rows_skipped']} dry_run={stats['dry_run']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
