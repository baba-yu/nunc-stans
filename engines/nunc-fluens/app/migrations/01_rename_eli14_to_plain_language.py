"""One-shot migration: rename eli14 → plain_language (predictions) + one_liner_eli14 → quick_def (glossary).

Idempotent: re-running on an already-migrated DB is a no-op.

Usage:
    python -m app.migrations.01_rename_eli14_to_plain_language --db app/data/analytics.sqlite
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from pathlib import Path


PREDICTION_RENAMES = [
    ("eli14",     "plain_language"),
    ("eli14_ja",  "plain_language_ja"),
    ("eli14_es",  "plain_language_es"),
    ("eli14_fil", "plain_language_fil"),
]

GLOSSARY_RENAMES = [
    ("one_liner_eli14",     "quick_def"),
    ("one_liner_eli14_ja",  "quick_def_ja"),
    ("one_liner_eli14_es",  "quick_def_es"),
    ("one_liner_eli14_fil", "quick_def_fil"),
]


def _columns(conn: sqlite3.Connection, table: str) -> set[str]:
    return {r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()}


def migrate(db_path: Path) -> dict:
    if not db_path.is_file():
        raise FileNotFoundError(f"DB not found: {db_path}")
    conn = sqlite3.connect(db_path)
    renamed: list[str] = []
    try:
        for table, renames in (
            ("predictions",    PREDICTION_RENAMES),
            ("glossary_terms", GLOSSARY_RENAMES),
        ):
            cols = _columns(conn, table)
            for old, new in renames:
                if old in cols and new not in cols:
                    conn.execute(f"ALTER TABLE {table} RENAME COLUMN {old} TO {new}")
                    renamed.append(f"{table}.{old} → {new}")
                elif old in cols and new in cols:
                    raise RuntimeError(
                        f"{table}: both {old!r} and {new!r} present — manual intervention needed"
                    )
        conn.commit()
    finally:
        conn.close()
    return {"db": str(db_path), "renamed": renamed, "count": len(renamed)}


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--db", required=True, type=Path)
    args = p.parse_args(argv)
    try:
        result = migrate(args.db)
    except (FileNotFoundError, RuntimeError) as e:
        print(f"FAIL {e}", file=sys.stderr)
        return 2
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
