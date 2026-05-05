"""Tests for `init_glossary_seed` insert and upsert modes."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

import pytest

from skills.extract_glossary_candidates import init_glossary_seed
from src import db


_SEED_V1 = """\
terms:
  - term: TestTerm
    aliases: [TT]
    one_liner_eli14: "v1 EN definition"
    one_liner_eli14_ja: "v1 JA"
    one_liner_eli14_es: "v1 ES"
    one_liner_eli14_fil: "v1 FIL"
    why_it_matters: "v1 EN why"
    why_it_matters_ja: "v1 JA why"
    why_it_matters_es: "v1 ES why"
    why_it_matters_fil: "v1 FIL why"
    canonical_link: https://example.com/v1
    status: active
    reviewed_by_human: true
"""

_SEED_V2 = """\
terms:
  - term: TestTerm
    aliases: [TT, "Test Term"]
    one_liner_eli14: "v2 EN definition"
    one_liner_eli14_ja: "v2 JA"
    one_liner_eli14_es: "v2 ES"
    one_liner_eli14_fil: "v2 FIL"
    why_it_matters: "v2 EN why"
    why_it_matters_ja: "v2 JA why"
    why_it_matters_es: "v2 ES why"
    why_it_matters_fil: "v2 FIL why"
    canonical_link: https://example.com/v2
    status: retired
    reviewed_by_human: true
"""


@pytest.fixture()
def conn_and_yaml(tmp_path: Path):
    db_path = tmp_path / "analytics.sqlite"
    db.init_db(db_path)
    conn = sqlite3.connect(str(db_path))
    seed = tmp_path / "glossary.yml"
    yield conn, seed
    conn.close()


def _row(conn: sqlite3.Connection, term: str) -> sqlite3.Row:
    conn.row_factory = sqlite3.Row
    return conn.execute("SELECT * FROM glossary_terms WHERE term = ?", (term,)).fetchone()


def test_insert_mode_adds_new_term(conn_and_yaml):
    conn, seed = conn_and_yaml
    seed.write_text(_SEED_V1, encoding="utf-8")
    counts = init_glossary_seed(conn, seed, mode="insert")
    assert counts == {"inserted": 1, "updated": 0}
    row = _row(conn, "TestTerm")
    assert row["one_liner_eli14"] == "v1 EN definition"
    assert json.loads(row["aliases_json"]) == ["TT"]
    assert row["status"] == "active"


def test_insert_mode_skips_existing(conn_and_yaml):
    conn, seed = conn_and_yaml
    seed.write_text(_SEED_V1, encoding="utf-8")
    init_glossary_seed(conn, seed, mode="insert")

    # Re-seed with v2; insert mode must NOT touch the existing row.
    seed.write_text(_SEED_V2, encoding="utf-8")
    counts = init_glossary_seed(conn, seed, mode="insert")
    assert counts == {"inserted": 0, "updated": 0}
    row = _row(conn, "TestTerm")
    assert row["one_liner_eli14"] == "v1 EN definition"
    assert row["canonical_link"] == "https://example.com/v1"
    assert row["status"] == "active"


def test_upsert_mode_updates_existing(conn_and_yaml):
    conn, seed = conn_and_yaml
    seed.write_text(_SEED_V1, encoding="utf-8")
    init_glossary_seed(conn, seed, mode="insert")

    # Simulate the daily flow having bumped DB-owned counters.
    conn.execute(
        "UPDATE glossary_terms SET occurrences_30d = 42, distinct_days_14d = 7, "
        "last_seen_date = '2026-05-04' WHERE term = ?",
        ("TestTerm",),
    )
    conn.commit()
    pre = _row(conn, "TestTerm")

    seed.write_text(_SEED_V2, encoding="utf-8")
    counts = init_glossary_seed(conn, seed, mode="upsert")
    assert counts == {"inserted": 0, "updated": 1}

    post = _row(conn, "TestTerm")
    # YAML-owned fields: overwritten.
    assert post["one_liner_eli14"] == "v2 EN definition"
    assert post["one_liner_eli14_ja"] == "v2 JA"
    assert post["why_it_matters_fil"] == "v2 FIL why"
    assert post["canonical_link"] == "https://example.com/v2"
    assert post["status"] == "retired"
    assert json.loads(post["aliases_json"]) == ["TT", "Test Term"]
    # DB-owned fields: preserved.
    assert post["occurrences_30d"] == 42
    assert post["distinct_days_14d"] == 7
    assert post["last_seen_date"] == "2026-05-04"
    assert post["first_seen_date"] == pre["first_seen_date"]
    # updated_at: bumped on UPDATE.
    assert post["updated_at"] is not None


def test_upsert_mode_inserts_when_missing(conn_and_yaml):
    conn, seed = conn_and_yaml
    seed.write_text(_SEED_V1, encoding="utf-8")
    counts = init_glossary_seed(conn, seed, mode="upsert")
    # Empty DB — upsert behaves as insert for new terms.
    assert counts == {"inserted": 1, "updated": 0}


def test_unknown_mode_raises(conn_and_yaml):
    conn, seed = conn_and_yaml
    seed.write_text(_SEED_V1, encoding="utf-8")
    with pytest.raises(ValueError, match="unknown seed mode"):
        init_glossary_seed(conn, seed, mode="overwrite")


def test_missing_yaml_returns_zero_counts(conn_and_yaml):
    conn, seed = conn_and_yaml
    # seed file deliberately not created
    counts = init_glossary_seed(conn, seed, mode="upsert")
    assert counts == {"inserted": 0, "updated": 0}
