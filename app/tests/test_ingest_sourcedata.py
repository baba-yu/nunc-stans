"""Tests for the sourcedata reader path (Phase 2).

Covers:

  * Schema validation rejects malformed input (``PredictionsFile``).
  * Round-trip from a hand-written ``predictions.json`` to a DB row,
    asserting that every structured column maps as documented in
    ``design/sourcedata-layout.md §JSON schemas (canonical)``.
  * Round-trip for ``needs.json`` (per-prediction Need + 5W1H task rows).
  * Locale fan-in fills the ``predictions._<locale>`` columns.

Each test uses a temp dir + an isolated sqlite DB seeded from the
bundled ``app/src/schema.sql`` so the real ``app/data/analytics.sqlite``
is never touched.
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

import pytest

from app.skills.ingest_sourcedata import ingest_day, ingest_day_locales
from app.skills.sourcedata_schemas import (
    PredictionsFile,
    SourcedataValidationError,
)


REPO_ROOT_REAL = Path(__file__).resolve().parents[2]
SCHEMA_SQL = (REPO_ROOT_REAL / "app" / "src" / "schema.sql").read_text(
    encoding="utf-8"
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def fake_repo(tmp_path: Path) -> Path:
    """Stand up a minimal fake repo: empty ``app/sourcedata/`` ready to fill."""
    (tmp_path / "app" / "sourcedata").mkdir(parents=True)
    return tmp_path


@pytest.fixture()
def conn() -> sqlite3.Connection:
    c = sqlite3.connect(":memory:")
    c.row_factory = sqlite3.Row
    c.executescript(SCHEMA_SQL)
    yield c
    c.close()


def _write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


# Sample sourcedata payloads ------------------------------------------------


SAMPLE_DATE = "2099-01-01"


def _sample_predictions() -> dict:
    return {
        "date": SAMPLE_DATE,
        "predictions": [
            {
                "id": "prediction.demo01",
                "title": "Demo prediction title",
                "body": (
                    "Demo prediction body — long-form prose explaining "
                    "what the prediction is and why."
                ),
                "reasoning": {
                    "because": "observed precondition",
                    "given": "structural force",
                    "so_that": "consequence",
                    "landing": "by Q4 2099",
                    "plain_language": "in plain English, the thing happens",
                },
                "summary": "mid-tier summary, ~200 chars of plain technical prose.",
            },
        ],
    }


def _sample_needs() -> dict:
    return {
        "date": SAMPLE_DATE,
        "by_prediction": {
            "prediction.demo01": [
                {
                    "actor": "demo actor role",
                    "job": "drive demo prediction toward landing",
                    "outcome": "concrete deliverable",
                    "motivation": "why the actor pushes this",
                    "task": {
                        "who": "team A + team B",
                        "what": "negotiate demo X",
                        "where": "joint working session",
                        "when": "May to Q3 2099",
                        "why": "structural reason",
                        "how": "press wire + filing",
                    },
                },
            ],
        },
    }


# ---------------------------------------------------------------------------
# 1. Schema validation
# ---------------------------------------------------------------------------


def test_schema_validation_rejects_missing_field():
    """PredictionsFile.from_dict raises when required fields are absent."""
    bad = {
        "date": SAMPLE_DATE,
        "predictions": [
            {
                "id": "prediction.demo01",
                "title": "Demo prediction title",
                # NOTE: 'body' is intentionally missing.
                "reasoning": {
                    "because": "x",
                    "given": "x",
                    "so_that": "x",
                    "landing": "x",
                    "plain_language": "x",
                },
                "summary": "x",
            },
        ],
    }
    with pytest.raises(SourcedataValidationError) as ei:
        PredictionsFile.from_dict(bad)
    msg = str(ei.value)
    assert "body" in msg, f"error should name the missing field; got {msg!r}"


# ---------------------------------------------------------------------------
# 2. Round-trip: predictions
# ---------------------------------------------------------------------------


def test_round_trip_predictions(fake_repo: Path, conn: sqlite3.Connection):
    """Hand-written predictions.json → ingest_day → DB columns match JSON."""
    payload = _sample_predictions()
    _write_json(
        fake_repo / "app" / "sourcedata" / SAMPLE_DATE / "predictions.json",
        payload,
    )

    summary = ingest_day(conn, fake_repo, SAMPLE_DATE)
    assert summary["predictions"] == 1, summary

    row = conn.execute(
        """
        SELECT prediction_summary, title, prediction_short_label, prediction_date,
               reasoning_because, reasoning_given, reasoning_so_that,
               reasoning_landing, eli14, summary, source_row_index
        FROM predictions WHERE prediction_date = ?
        """,
        (SAMPLE_DATE,),
    ).fetchone()
    assert row is not None, "predictions row was not written"

    p = payload["predictions"][0]
    r = dict(row)
    assert r["prediction_summary"] == p["body"]
    assert r["title"] == p["title"]
    assert r["prediction_short_label"] == p["title"]
    assert r["prediction_date"] == SAMPLE_DATE
    assert r["reasoning_because"] == p["reasoning"]["because"]
    assert r["reasoning_given"] == p["reasoning"]["given"]
    assert r["reasoning_so_that"] == p["reasoning"]["so_that"]
    assert r["reasoning_landing"] == p["reasoning"]["landing"]
    # The single JSON ↔ DB column rename: plain_language -> eli14.
    assert r["eli14"] == p["reasoning"]["plain_language"]
    assert r["summary"] == p["summary"]
    assert r["source_row_index"] == 0

    # Idempotency: a second ingest of the same JSON must not duplicate.
    ingest_day(conn, fake_repo, SAMPLE_DATE)
    cnt = conn.execute(
        "SELECT COUNT(*) AS n FROM predictions WHERE prediction_date = ?",
        (SAMPLE_DATE,),
    ).fetchone()["n"]
    assert cnt == 1, f"re-ingest duplicated: {cnt} rows"


# ---------------------------------------------------------------------------
# 3. Round-trip: needs
# ---------------------------------------------------------------------------


def test_round_trip_needs(fake_repo: Path, conn: sqlite3.Connection):
    """Predictions + needs JSON → DB rows match per-prediction Needs + tasks."""
    _write_json(
        fake_repo / "app" / "sourcedata" / SAMPLE_DATE / "predictions.json",
        _sample_predictions(),
    )
    needs_payload = _sample_needs()
    _write_json(
        fake_repo / "app" / "sourcedata" / SAMPLE_DATE / "needs.json",
        needs_payload,
    )

    summary = ingest_day(conn, fake_repo, SAMPLE_DATE)
    assert summary["needs"] == 1, summary

    # Resolve the DB prediction id (hash from date+body).
    pid_row = conn.execute(
        "SELECT prediction_id FROM predictions WHERE prediction_date = ?",
        (SAMPLE_DATE,),
    ).fetchone()
    assert pid_row is not None
    pid = pid_row["prediction_id"]

    need_rows = conn.execute(
        """
        SELECT n.actor, n.job, n.outcome, n.motivation,
               t.who_text, t.what_text, t.where_text,
               t.when_text, t.why_text, t.how_text, t.status
        FROM prediction_needs n
        LEFT JOIN needs_tasks t ON t.need_id = n.need_id
        WHERE n.prediction_id = ?
        ORDER BY n.actor
        """,
        (pid,),
    ).fetchall()
    assert len(need_rows) == 1, need_rows
    nr = dict(need_rows[0])
    src = needs_payload["by_prediction"]["prediction.demo01"][0]
    assert nr["actor"] == src["actor"]
    assert nr["job"] == src["job"]
    assert nr["outcome"] == src["outcome"]
    assert nr["motivation"] == src["motivation"]
    t = src["task"]
    assert nr["who_text"] == t["who"]
    assert nr["what_text"] == t["what"]
    assert nr["where_text"] == t["where"]
    assert nr["when_text"] == t["when"]
    assert nr["why_text"] == t["why"]
    assert nr["how_text"] == t["how"]
    # Full 5W1H present, so status must be 'open' (vs 'blocked').
    assert nr["status"] == "open"


# ---------------------------------------------------------------------------
# 4. Locale fan-in fills _<locale> columns
# ---------------------------------------------------------------------------


def test_locale_columns_filled(fake_repo: Path, conn: sqlite3.Connection):
    """ingest_day_locales fills predictions.title_ja etc. from locale JSON."""
    _write_json(
        fake_repo / "app" / "sourcedata" / SAMPLE_DATE / "predictions.json",
        _sample_predictions(),
    )

    ja_payload = _sample_predictions()
    p = ja_payload["predictions"][0]
    p["title"] = "デモ予測のタイトル"
    p["body"] = "日本語の本文 — 散文。"
    p["summary"] = "日本語のミッドティアまとめ。"
    p["reasoning"] = {
        "because": "前提条件",
        "given": "構造的な力",
        "so_that": "結果",
        "landing": "2099年 第4四半期までに",
        "plain_language": "簡単に言えば、これが起こる",
    }
    _write_json(
        fake_repo / "app" / "sourcedata" / "locales" / SAMPLE_DATE / "ja"
        / "predictions.json",
        ja_payload,
    )

    ingest_day(conn, fake_repo, SAMPLE_DATE)
    loc_summary = ingest_day_locales(conn, fake_repo, SAMPLE_DATE)
    assert loc_summary["ja"]["predictions"] == 1, loc_summary

    row = conn.execute(
        """
        SELECT title_ja, prediction_summary_ja, prediction_short_label_ja,
               summary_ja,
               reasoning_because_ja, reasoning_given_ja,
               reasoning_so_that_ja, reasoning_landing_ja, eli14_ja
        FROM predictions WHERE prediction_date = ?
        """,
        (SAMPLE_DATE,),
    ).fetchone()
    assert row is not None
    r = dict(row)
    assert r["title_ja"] == p["title"]
    assert r["prediction_summary_ja"] == p["body"]
    assert r["prediction_short_label_ja"] == p["title"]
    assert r["summary_ja"] == p["summary"]
    assert r["reasoning_because_ja"] == p["reasoning"]["because"]
    assert r["reasoning_given_ja"] == p["reasoning"]["given"]
    assert r["reasoning_so_that_ja"] == p["reasoning"]["so_that"]
    assert r["reasoning_landing_ja"] == p["reasoning"]["landing"]
    assert r["eli14_ja"] == p["reasoning"]["plain_language"]
