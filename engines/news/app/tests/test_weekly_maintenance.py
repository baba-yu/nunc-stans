"""Tests for ``app.skills.weekly_maintenance`` (Sunday slot 5.5).

Spec: ``design/scheduled/6_weekly_maintenance.md``.

Every test runs against ``sqlite3.connect(":memory:")`` seeded from a
fresh ``app/src/schema.sql`` dump. The live ``app/data/analytics.sqlite``
is NEVER touched (super-backfill may be writing it concurrently).

Coverage:

  1. Active+dormant filter (Step 0 SQL gate, dormant intersection).
  2. 90-day window filter (Step 0 SQL gate, age intersection).
  3. New contradict change-signal surfaces a prediction.
  4. Relevance-drift change-signal surfaces a prediction.
  5. Cap of 30 with overflow into the spillover queue.
  6. ``merge_judgements_files`` deduplicates and orders.
  7. ``validate_run`` passes on a clean stale-applied + retire-flipped run.
  8. ``validate_run`` fails on a stale verdict with no applied JSON.
  9. Health check warns on a 100-day-old non-dormant prediction.
"""

from __future__ import annotations

import datetime as dt
import json
import sqlite3
from pathlib import Path

import pytest

from app.skills.sourcedata_schemas import (
    MaintenanceCandidatesFile,
    MaintenanceJudgementsFile,
)
from app.skills.weekly_maintenance import (
    compute_candidates,
    merge_judgements_files,
    merge_spillover_into_queue,
    parse_dormant_snapshot,
    validate_run,
    write_health_log,
)


REPO_ROOT_REAL = Path(__file__).resolve().parents[2]
SCHEMA_SQL = (REPO_ROOT_REAL / "app" / "src" / "schema.sql").read_text(
    encoding="utf-8"
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def conn() -> sqlite3.Connection:
    """Fresh in-memory SQLite seeded from schema.sql."""
    c = sqlite3.connect(":memory:")
    c.row_factory = sqlite3.Row
    c.executescript(SCHEMA_SQL)
    yield c
    c.close()


WEEK_ENDING = "2026-05-10"


def _seed_prediction(
    conn: sqlite3.Connection,
    pid: str,
    *,
    prediction_date: str,
    summary: str = "demo prediction",
    huge_longshot_hit_at: str | None = None,
) -> None:
    conn.execute(
        """
        INSERT INTO predictions (
            prediction_id, prediction_summary, prediction_date,
            huge_longshot_hit_at
        ) VALUES (?, ?, ?, ?)
        """,
        (pid, summary, prediction_date, huge_longshot_hit_at),
    )


def _seed_source_file(conn: sqlite3.Connection, sfid: str = "sf.synth") -> str:
    """Insert a synthetic source_files row (FK target). Idempotent."""
    conn.execute(
        """
        INSERT OR IGNORE INTO source_files (source_file_id, path, file_type)
        VALUES (?, ?, 'daily_report')
        """,
        (sfid, f"/synthetic/{sfid}.md"),
    )
    return sfid


def _seed_evidence(conn: sqlite3.Connection, evid: str) -> None:
    """Minimal evidence_items row so prediction_evidence_links FK holds."""
    conn.execute(
        """
        INSERT INTO evidence_items (
            evidence_id, first_seen_date, summary
        ) VALUES (?, ?, ?)
        """,
        (evid, "2026-05-08", "demo evidence"),
    )


def _seed_contradict_link(
    conn: sqlite3.Connection,
    *,
    prediction_id: str,
    evidence_id: str,
    validation_date: str,
    scope_id: str = "tech",
) -> None:
    conn.execute(
        """
        INSERT INTO prediction_evidence_links (
            prediction_id, evidence_id, scope_id, support_direction,
            evidence_recency_type, validation_date
        ) VALUES (?, ?, ?, 'contradict', 'new', ?)
        """,
        (prediction_id, evidence_id, scope_id, validation_date),
    )


def _seed_validation_row(
    conn: sqlite3.Connection,
    *,
    vrid: str,
    prediction_id: str,
    validation_date: str,
    observed_relevance: int,
) -> None:
    sfid = _seed_source_file(conn)
    conn.execute(
        """
        INSERT INTO validation_rows (
            validation_row_id, source_file_id, validation_date,
            prediction_id, prediction_summary, observed_relevance
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        (vrid, sfid, validation_date, prediction_id,
         "row summary", observed_relevance),
    )


# ---------------------------------------------------------------------------
# 1. Dormant filter
# ---------------------------------------------------------------------------


def test_candidates_filters_by_dormant(conn: sqlite3.Connection) -> None:
    today = WEEK_ENDING
    seven_days_ago = (
        dt.date.fromisoformat(today) - dt.timedelta(days=3)
    ).isoformat()
    # Five active-window predictions, all in 90d window.
    pids = [f"prediction.demo{i:02d}" for i in range(5)]
    for pid in pids:
        _seed_prediction(conn, pid, prediction_date="2026-04-15")
    _seed_evidence(conn, "ev.x")
    # Give each one a contradict signal so they all qualify on signal-side.
    for pid in pids:
        _seed_contradict_link(
            conn,
            prediction_id=pid,
            evidence_id="ev.x",
            validation_date=seven_days_ago,
        )
    dormant = {pids[0], pids[1]}
    payload = compute_candidates(conn, today, dormant)
    surfaced = {p["prediction_id"] for p in payload["predictions"]}
    assert surfaced == set(pids[2:]), surfaced
    # Sanity: payload is schema-valid before we serialize.
    serial = {
        "week_ending": payload["week_ending"],
        "predictions": payload["predictions"],
        "glossary_terms": payload["glossary_terms"],
    }
    MaintenanceCandidatesFile.from_dict(serial)


# ---------------------------------------------------------------------------
# 2. 90-day window filter
# ---------------------------------------------------------------------------


def test_candidates_filters_by_90day_window(conn: sqlite3.Connection) -> None:
    today = WEEK_ENDING
    six_days_ago = (
        dt.date.fromisoformat(today) - dt.timedelta(days=6)
    ).isoformat()
    _seed_evidence(conn, "ev.y")
    # Spread across 200 days: 0, 30, 60, 89, 91, 120, 200 days old.
    cases = [
        ("prediction.in_30d", 30),
        ("prediction.in_60d", 60),
        ("prediction.in_89d", 89),
        ("prediction.at_91d", 91),
        ("prediction.at_120d", 120),
        ("prediction.at_200d", 200),
    ]
    for pid, days in cases:
        date = (
            dt.date.fromisoformat(today) - dt.timedelta(days=days)
        ).isoformat()
        _seed_prediction(conn, pid, prediction_date=date)
        _seed_contradict_link(
            conn,
            prediction_id=pid,
            evidence_id="ev.y",
            validation_date=six_days_ago,
        )
    payload = compute_candidates(conn, today, set())
    surfaced = {p["prediction_id"] for p in payload["predictions"]}
    # 0/30/60/89 in; 91/120/200 out.
    assert surfaced == {
        "prediction.in_30d",
        "prediction.in_60d",
        "prediction.in_89d",
    }, surfaced


# ---------------------------------------------------------------------------
# 3. Contradict change-signal
# ---------------------------------------------------------------------------


def test_candidates_change_signal_contradict(conn: sqlite3.Connection) -> None:
    today = WEEK_ENDING
    # Two predictions in the active window; only one has a fresh
    # contradict link.
    _seed_prediction(conn, "prediction.with_contradict",
                     prediction_date="2026-05-01")
    _seed_prediction(conn, "prediction.no_signal",
                     prediction_date="2026-05-01")
    _seed_evidence(conn, "ev.contradict")
    _seed_contradict_link(
        conn,
        prediction_id="prediction.with_contradict",
        evidence_id="ev.contradict",
        validation_date="2026-05-08",
    )
    payload = compute_candidates(conn, today, set())
    surfaced = {p["prediction_id"]: p for p in payload["predictions"]}
    assert "prediction.with_contradict" in surfaced
    assert "prediction.no_signal" not in surfaced
    rec = surfaced["prediction.with_contradict"]
    assert "new_contradict" in rec["change_signals"]
    assert rec["confidence_drift_score"] > 0


# ---------------------------------------------------------------------------
# 4. Relevance-drift change-signal
# ---------------------------------------------------------------------------


def test_candidates_change_signal_relevance_drift(
    conn: sqlite3.Connection,
) -> None:
    today = WEEK_ENDING
    _seed_prediction(
        conn, "prediction.drifty", prediction_date="2026-05-01"
    )
    _seed_prediction(
        conn, "prediction.stable", prediction_date="2026-05-01"
    )
    # Drifty: relevance 5 in last 7 days, 2 in the prior week (delta 3).
    _seed_validation_row(
        conn, vrid="vr.drift.this_week",
        prediction_id="prediction.drifty",
        validation_date="2026-05-08", observed_relevance=5,
    )
    _seed_validation_row(
        conn, vrid="vr.drift.prior",
        prediction_id="prediction.drifty",
        validation_date="2026-04-30", observed_relevance=2,
    )
    # Stable: relevance 4 in this week, 3 in prior week (delta 1, NOT >= 2).
    _seed_validation_row(
        conn, vrid="vr.stable.this_week",
        prediction_id="prediction.stable",
        validation_date="2026-05-08", observed_relevance=4,
    )
    _seed_validation_row(
        conn, vrid="vr.stable.prior",
        prediction_id="prediction.stable",
        validation_date="2026-04-30", observed_relevance=3,
    )
    payload = compute_candidates(conn, today, set())
    surfaced = {p["prediction_id"]: p for p in payload["predictions"]}
    assert "prediction.drifty" in surfaced
    assert "prediction.stable" not in surfaced
    assert "relevance_drift" in surfaced["prediction.drifty"]["change_signals"]


# ---------------------------------------------------------------------------
# 5. Cap of 30 with spillover
# ---------------------------------------------------------------------------


def test_candidates_cap_30_and_spillover(
    conn: sqlite3.Connection, tmp_path: Path
) -> None:
    today = WEEK_ENDING
    seven_days_ago = (
        dt.date.fromisoformat(today) - dt.timedelta(days=2)
    ).isoformat()
    _seed_evidence(conn, "ev.bulk")
    # 50 active+contradicting predictions so the cap kicks in.
    pids = [f"prediction.bulk{i:02d}" for i in range(50)]
    for pid in pids:
        _seed_prediction(conn, pid, prediction_date="2026-04-20")
        _seed_contradict_link(
            conn,
            prediction_id=pid,
            evidence_id="ev.bulk",
            validation_date=seven_days_ago,
        )
    payload = compute_candidates(conn, today, set())
    assert len(payload["predictions"]) == 30
    assert len(payload["spillover"]["predictions"]) == 20

    # Round-trip through queue.md: starvation counters bump.
    queue_path = tmp_path / "memory" / "maintenance" / "queue.md"
    merge_spillover_into_queue(queue_path, payload["spillover"], today)
    text = queue_path.read_text(encoding="utf-8")
    assert "## 2026-05-10" in text
    # Each spillover ID appears once with weeks_starved=1.
    spillover_ids = {p["prediction_id"] for p in payload["spillover"]["predictions"]}
    for pid in spillover_ids:
        assert pid in text
    # Run a SECOND week: the same overlap should bump to 2.
    next_week = "2026-05-17"
    merge_spillover_into_queue(queue_path, payload["spillover"], next_week)
    text2 = queue_path.read_text(encoding="utf-8")
    assert "## 2026-05-17" in text2
    sample = next(iter(spillover_ids))
    assert f"| {sample} | 2026-05-17 | 2 |" in text2


# ---------------------------------------------------------------------------
# 6. merge-judgements dedupe + ordering
# ---------------------------------------------------------------------------


def test_merge_judgements_dedup(tmp_path: Path) -> None:
    date_dir = tmp_path / "app" / "sourcedata" / WEEK_ENDING
    date_dir.mkdir(parents=True)

    def _judgement(pid: str, stream: str, entry_id: str,
                   verdict: str = "stale") -> dict:
        return {
            "prediction_id": pid,
            "stream": stream,
            "entry_id": entry_id,
            "verdict": verdict,
            "reason": "synthetic test reason",
            "cross_stream_evidence": [],
            "proposed_action": "rewrite",
            "confidence": 0.9,
        }

    # Per-prediction file shape A: full bundle.
    (date_dir / "maintenance-judgements.prediction.aaa.json").write_text(
        json.dumps({
            "week_ending": WEEK_ENDING,
            "judgements": [
                _judgement("prediction.aaa", "reasoning", "prediction.aaa"),
                _judgement("prediction.aaa", "needs", "need.x"),
                # Duplicate — should dedupe.
                _judgement("prediction.aaa", "reasoning", "prediction.aaa"),
            ],
        }),
        encoding="utf-8",
    )
    # Shape B: per-pred dict.
    (date_dir / "maintenance-judgements.prediction.bbb.json").write_text(
        json.dumps({
            "prediction_id": "prediction.bbb",
            "judgements": [
                _judgement("prediction.bbb", "bridge", "vr.bbb.1"),
            ],
        }),
        encoding="utf-8",
    )
    # Shape C: bare list (per-pred).
    (date_dir / "maintenance-judgements.prediction.ccc.json").write_text(
        json.dumps([
            _judgement("prediction.ccc", "readings", "chain.ccc"),
        ]),
        encoding="utf-8",
    )
    # Glossary batch file.
    (date_dir / "maintenance-judgements.glossary.json").write_text(
        json.dumps({
            "week_ending": WEEK_ENDING,
            "judgements": [
                _judgement("", "glossary", "MCP", verdict="retire"),
                _judgement("", "glossary", "RAG", verdict="stale"),
            ],
        }),
        encoding="utf-8",
    )

    out = merge_judgements_files(date_dir)
    bundle = MaintenanceJudgementsFile.from_dict(
        json.loads(out.read_text(encoding="utf-8"))
    )
    assert bundle.week_ending == WEEK_ENDING
    # Expected: 2 + 1 + 1 + 2 = 6 (one duplicate dropped).
    assert len(bundle.judgements) == 6
    # Deterministic order: prediction_id, stream, entry_id.
    keys = [(j.prediction_id, j.stream, j.entry_id) for j in bundle.judgements]
    assert keys == sorted(keys), keys


# ---------------------------------------------------------------------------
# 7. validate passes on a clean run
# ---------------------------------------------------------------------------


def test_validate_passes_on_clean_run(tmp_path: Path) -> None:
    repo = tmp_path
    week_dir = repo / "app" / "sourcedata" / WEEK_ENDING
    week_dir.mkdir(parents=True)

    # A glossary retire that the orchestrator HAS flipped in the DB.
    judgements = [
        {
            "prediction_id": "prediction.aaa",
            "stream": "reasoning",
            "entry_id": "prediction.aaa",
            "verdict": "stale",
            "reason": "synthetic",
            "cross_stream_evidence": [],
            "proposed_action": "rewrite",
            "confidence": 0.85,
        },
        {
            "prediction_id": "",
            "stream": "glossary",
            "entry_id": "FROST",
            "verdict": "retire",
            "reason": "no longer cited",
            "cross_stream_evidence": [],
            "proposed_action": "retire",
            "confidence": 0.95,
        },
    ]
    (week_dir / "maintenance-judgements.json").write_text(
        json.dumps({"week_ending": WEEK_ENDING, "judgements": judgements}),
        encoding="utf-8",
    )
    # The 'stale' applied marker: per-pid predictions JSON.
    (week_dir / "predictions.prediction.aaa.json").write_text(
        json.dumps({"prediction_id": "prediction.aaa"}), encoding="utf-8"
    )
    # The 'retire' DB flip — synthesize a tiny SQLite with the retired row.
    db_path = repo / "app" / "data" / "analytics.sqlite"
    db_path.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(db_path)
    c.executescript(SCHEMA_SQL)
    c.execute(
        """
        INSERT INTO glossary_terms (term, status, first_seen_date)
        VALUES ('FROST', 'retired', '2026-04-01')
        """
    )
    c.commit()
    c.close()

    errors = validate_run(repo, WEEK_ENDING, db_path=db_path)
    assert errors == [], errors


# ---------------------------------------------------------------------------
# 8. validate fails on an unapplied stale verdict
# ---------------------------------------------------------------------------


def test_validate_fails_on_unapplied_stale(tmp_path: Path) -> None:
    repo = tmp_path
    week_dir = repo / "app" / "sourcedata" / WEEK_ENDING
    week_dir.mkdir(parents=True)
    judgements = [
        {
            "prediction_id": "prediction.unapplied",
            "stream": "reasoning",
            "entry_id": "prediction.unapplied",
            "verdict": "stale",
            "reason": "synthetic",
            "cross_stream_evidence": [],
            "proposed_action": "rewrite",
            "confidence": 0.85,
        }
    ]
    (week_dir / "maintenance-judgements.json").write_text(
        json.dumps({"week_ending": WEEK_ENDING, "judgements": judgements}),
        encoding="utf-8",
    )
    # Deliberately do NOT write the per-pid predictions JSON.
    db_path = repo / "app" / "data" / "analytics.sqlite"
    db_path.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(db_path)
    c.executescript(SCHEMA_SQL)
    c.close()

    errors = validate_run(repo, WEEK_ENDING, db_path=db_path)
    assert errors, "expected validate to surface the unapplied stale"
    assert any("prediction.unapplied" in e for e in errors)
    assert any("verdict=stale" in e for e in errors)


# ---------------------------------------------------------------------------
# 9. Health check warns on old non-dormant predictions
# ---------------------------------------------------------------------------


def test_health_check_warns_on_old_active(
    conn: sqlite3.Connection, tmp_path: Path
) -> None:
    today = WEEK_ENDING
    old_date = (
        dt.date.fromisoformat(today) - dt.timedelta(days=100)
    ).isoformat()
    _seed_prediction(
        conn, "prediction.leaked", prediction_date=old_date
    )
    # Also a normal prediction so the run isn't completely empty.
    _seed_prediction(
        conn, "prediction.recent", prediction_date="2026-05-01"
    )
    payload = compute_candidates(conn, today, set())
    # Neither belongs in the surfaced set (one too old, one with no signal).
    assert all(
        p["prediction_id"] != "prediction.leaked" for p in payload["predictions"]
    )
    # But the health log should warn.
    assert payload["health_warnings"], "expected health warning"
    assert any(
        "prediction.leaked" in w for w in payload["health_warnings"]
    )

    # And write_health_log persists without abort.
    health_path = tmp_path / "memory" / "maintenance" / today / "health.md"
    write_health_log(health_path, today, payload["health_warnings"])
    assert health_path.is_file()
    text = health_path.read_text(encoding="utf-8")
    assert "prediction.leaked" in text


# ---------------------------------------------------------------------------
# Bonus: dormant-snapshot parser
# ---------------------------------------------------------------------------


def test_parse_dormant_snapshot_pulls_table_ids() -> None:
    text = """# Dormant pool — week ending 2026-05-03

Some prose ... mentions prediction.deadbeefcafe1234 inline.

| ID | Prediction (short) |
|---|---|
| 20260420-3 | "Headless Everything" |
| 20260419-1 | 1-bit native training |
"""
    ids = parse_dormant_snapshot(text)
    assert "20260420-3" in ids
    assert "20260419-1" in ids
    assert "prediction.deadbeefcafe1234" in ids
