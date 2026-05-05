"""SQLite connection helpers and schema bootstrap.

Locale-aware schema notes (feature/locale branch):
  The schema gained locale columns on source_files / categories / themes
  / subthemes / predictions / validation_rows / evidence_items. SQLite
  does NOT support ADD COLUMN IF NOT EXISTS, so this module does not
  attempt a live migration. Pick up the new columns by deleting the
  existing analytics.sqlite and re-running ``python -m src.cli update``
  (the ingest pipeline is fully reproducible from the markdown corpus).
"""

from __future__ import annotations

import sqlite3
from pathlib import Path


def repo_root() -> Path:
    """Return the repo root (parent of app/)."""
    return Path(__file__).resolve().parents[2]


def db_path() -> Path:
    """Return absolute path to the analytics SQLite DB."""
    return repo_root() / "app" / "data" / "analytics.sqlite"


def schema_path() -> Path:
    """Return absolute path to the bundled schema.sql."""
    return Path(__file__).resolve().parent / "schema.sql"


def connect(path: Path | None = None) -> sqlite3.Connection:
    """Open a connection with foreign keys enabled."""
    p = path or db_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(p))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = MEMORY;"); conn.execute("PRAGMA temp_store = MEMORY;"); conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db(path: Path | None = None) -> Path:
    """Create (idempotent) the database by executing the bundled schema."""
    p = path or db_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    sql = schema_path().read_text(encoding="utf-8")
    conn = connect(p)
    try:
        conn.executescript(sql)
        conn.commit()
    finally:
        conn.close()
    return p
