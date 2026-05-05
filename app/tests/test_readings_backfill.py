"""Tests for the Phase 6.5a readings stream toolbox.

Covers:

  * ``ReadingsFile`` schema validation (round-trip + relation_type
    rejection).
  * ``apply_readings`` atomic-write hook in ``super_backfill``.
  * ``_ingest_readings_file`` round-trip into ``prediction_chain`` +
    ``prediction_relations``.
  * ``merge_readings_files`` deterministic merge of per-prediction
    files.
  * Idempotent re-ingest leaves DB row counts unchanged.

Each test seeds an in-memory sqlite DB from the bundled
``app/src/schema.sql`` so the real ``app/data/analytics.sqlite`` is
never touched.
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

import pytest

from app.skills import super_backfill as sb
from app.skills.ingest_sourcedata import ingest_day
from app.skills.sourcedata_schemas import (
    ReadingsFile,
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


SAMPLE_DATE = "2099-02-02"


def _seed_parent_rows(conn: sqlite3.Connection) -> None:
    """Seed the predictions + evidence rows that ``_valid_readings_payload``
    references via FK. The ingest of readings rows requires these parents
    to satisfy ``prediction_chain`` and ``prediction_relations`` FK
    constraints (schema.sql sets ``PRAGMA foreign_keys = ON``).

    In production, the daily-master flow has always populated these
    tables first; the test seeds them by hand to mirror that ordering.
    """
    pids = (
        "prediction.aaaaaaaaaaaaaaaa",
        "prediction.bbbbbbbbbbbbbbbb",
        "prediction.dddddddddddddddd",
        "prediction.eeeeeeeeeeeeeeee",
        "prediction.ffffffffffffffff",
        "prediction.gggggggggggggggg",
    )
    for pid in pids:
        conn.execute(
            """
            INSERT INTO predictions (
              prediction_id, prediction_summary,
              source_row_index, prediction_date, raw_text
            ) VALUES (?, ?, ?, ?, ?)
            """,
            (pid, f"body for {pid}", 0, SAMPLE_DATE, "raw"),
        )
    conn.execute(
        """
        INSERT INTO evidence_items (
          evidence_id, url, first_seen_date
        ) VALUES (?, ?, ?)
        """,
        ("evidence.cccccccccccccccc", "https://example.test/c", SAMPLE_DATE),
    )
    conn.commit()


def _valid_readings_payload(date_iso: str = SAMPLE_DATE) -> dict:
    """A readings.json payload exercising every shape: 2 chain edges, 2
    relations (one with family_id + prob_mass), 1 cluster pointer."""
    return {
        "date": date_iso,
        "chain_edges": [
            {
                "source_prediction_id": "prediction.aaaaaaaaaaaaaaaa",
                "downstream_prediction_id": "prediction.bbbbbbbbbbbbbbbb",
                "via_evidence_id": "evidence.cccccccccccccccc",
                "strength": 0.75,
                "notes": "evidence-mediated entailment",
            },
            {
                "source_prediction_id": "prediction.dddddddddddddddd",
                "downstream_prediction_id": "prediction.eeeeeeeeeeeeeeee",
                "via_evidence_id": None,
                "strength": 0.9,
                "notes": None,
            },
        ],
        "relations": [
            {
                "prediction_a": "prediction.aaaaaaaaaaaaaaaa",
                "prediction_b": "prediction.bbbbbbbbbbbbbbbb",
                "relation_type": "entails",
                "family_id": None,
                "prob_mass": None,
                "notes": "narrower entails broader",
            },
            {
                "prediction_a": "prediction.ffffffffffffffff",
                "prediction_b": "prediction.gggggggggggggggg",
                "relation_type": "exclusive_variant",
                "family_id": "family.ipo_price_tier",
                "prob_mass": 0.6,
                "notes": "tier B is most-supported",
            },
        ],
        "cluster_pointers": [
            {
                "prediction_id": "prediction.aaaaaaaaaaaaaaaa",
                "cluster_keys": [
                    "theme.foo|2099-05",
                    "theme.bar|2099-05",
                ],
            },
        ],
    }


# ---------------------------------------------------------------------------
# 1. Schema round-trip
# ---------------------------------------------------------------------------


def test_readings_schema_valid():
    """``ReadingsFile.from_dict({...}).to_dict()`` is a stable round-trip."""
    payload = _valid_readings_payload()
    rf = ReadingsFile.from_dict(payload)
    out = rf.to_dict()
    # Round-trip must preserve every key the writer set.
    assert out["date"] == payload["date"]
    assert out["chain_edges"] == payload["chain_edges"]
    assert out["relations"] == payload["relations"]
    assert out["cluster_pointers"] == payload["cluster_pointers"]
    # Idempotent: feeding the round-tripped output back through validates
    # cleanly and produces the same shape.
    rf2 = ReadingsFile.from_dict(out)
    assert rf2.to_dict() == out


# ---------------------------------------------------------------------------
# 2. Schema rejects bad relation_type
# ---------------------------------------------------------------------------


def test_readings_schema_rejects_bad_relation_type():
    """Invalid relation_type raises with a path-qualified error."""
    bad = _valid_readings_payload()
    bad["relations"][0]["relation_type"] = "definitely_not_a_relation"
    with pytest.raises(SourcedataValidationError) as ei:
        ReadingsFile.from_dict(bad)
    msg = str(ei.value)
    assert "relation_type" in msg, f"error should name the field; got {msg!r}"
    assert "definitely_not_a_relation" in msg


def test_readings_schema_rejects_strength_out_of_range():
    """``strength`` outside [0, 1] is rejected at validation time."""
    bad = _valid_readings_payload()
    bad["chain_edges"][0]["strength"] = 1.5
    with pytest.raises(SourcedataValidationError) as ei:
        ReadingsFile.from_dict(bad)
    assert "strength" in str(ei.value)


# ---------------------------------------------------------------------------
# 3. apply_readings atomic write
# ---------------------------------------------------------------------------


def test_apply_readings_atomic_write(tmp_path: Path):
    """Writes the file at the canonical path with valid JSON content."""
    payload = _valid_readings_payload(date_iso="2099-02-02")
    out = sb.apply_readings(tmp_path, "2099-02-02", payload)
    expected = tmp_path / "app/sourcedata/2099-02-02/readings.json"
    assert out == expected
    assert out.is_file()
    loaded = json.loads(out.read_text(encoding="utf-8"))
    assert loaded == payload
    # No leftover .tmp files in the directory.
    assert not any(p.suffix == ".tmp" for p in out.parent.iterdir())


def test_apply_readings_rejects_invalid_schema(tmp_path: Path):
    """Validation failure means no file is created."""
    bad = {"date": "2099-02-02", "chain_edges": [{"strength": 0.5}]}
    with pytest.raises(SourcedataValidationError):
        sb.apply_readings(tmp_path, "2099-02-02", bad)
    assert not (tmp_path / "app/sourcedata/2099-02-02/readings.json").exists()


# ---------------------------------------------------------------------------
# 4. Round-trip through ingest into the DB
# ---------------------------------------------------------------------------


def test_ingest_readings_round_trip(fake_repo: Path, conn: sqlite3.Connection):
    """Writing readings.json + ingest_day populates prediction_chain +
    prediction_relations rows; cluster_pointers stay in the JSON only."""
    _seed_parent_rows(conn)
    payload = _valid_readings_payload()
    out = sb.apply_readings(fake_repo, SAMPLE_DATE, payload)
    assert out.is_file()

    summary = ingest_day(conn, fake_repo, SAMPLE_DATE)
    rd = summary["readings"]
    assert rd["chain_edges"] == 2
    assert rd["relations"] == 2
    assert rd["cluster_pointers"] == 1

    # prediction_chain rows match the JSON edges.
    chain_rows = conn.execute(
        """
        SELECT source_prediction_id, downstream_prediction_id,
               via_evidence_id, strength, notes
        FROM prediction_chain
        ORDER BY source_prediction_id, downstream_prediction_id
        """
    ).fetchall()
    assert len(chain_rows) == 2
    rows_dicts = [dict(r) for r in chain_rows]
    src_ids = sorted(r["source_prediction_id"] for r in rows_dicts)
    assert src_ids == sorted(
        e["source_prediction_id"] for e in payload["chain_edges"]
    )
    # Verify the strength + via_evidence_id roundtrip on the first edge.
    aa_row = next(
        r for r in rows_dicts
        if r["source_prediction_id"] == "prediction.aaaaaaaaaaaaaaaa"
    )
    assert aa_row["downstream_prediction_id"] == "prediction.bbbbbbbbbbbbbbbb"
    assert aa_row["via_evidence_id"] == "evidence.cccccccccccccccc"
    assert abs(aa_row["strength"] - 0.75) < 1e-9
    assert aa_row["notes"] == "evidence-mediated entailment"

    # prediction_relations rows match the JSON relations.
    rel_rows = conn.execute(
        """
        SELECT prediction_a, prediction_b, relation_type, family_id,
               prob_mass, notes
        FROM prediction_relations
        ORDER BY prediction_a, prediction_b
        """
    ).fetchall()
    assert len(rel_rows) == 2
    rd2 = [dict(r) for r in rel_rows]
    types = sorted(r["relation_type"] for r in rd2)
    assert types == ["entails", "exclusive_variant"]
    ev_row = next(r for r in rd2 if r["relation_type"] == "exclusive_variant")
    assert ev_row["family_id"] == "family.ipo_price_tier"
    assert abs(ev_row["prob_mass"] - 0.6) < 1e-9


# ---------------------------------------------------------------------------
# 5. Deterministic merge across per-pid files
# ---------------------------------------------------------------------------


def test_merge_readings_files(fake_repo: Path):
    """Three per-pid readings files merge into one readings.json with
    deterministic order and no duplicates on the natural identity keys."""
    date_dir = fake_repo / "app" / "sourcedata" / SAMPLE_DATE
    date_dir.mkdir(parents=True)

    # File 1: pred A, one edge + one relation + one cluster pointer.
    f1 = {
        "chain_edges": [
            {
                "source_prediction_id": "prediction.A",
                "downstream_prediction_id": "prediction.B",
                "via_evidence_id": "evidence.X",
                "strength": 0.5,
                "notes": "first edge",
            }
        ],
        "relations": [
            {
                "prediction_a": "prediction.A",
                "prediction_b": "prediction.B",
                "relation_type": "parallel",
                "family_id": None,
                "prob_mass": None,
                "notes": None,
            }
        ],
        "cluster_pointers": [
            {
                "prediction_id": "prediction.A",
                "cluster_keys": ["theme.x|2099-05"],
            }
        ],
    }
    # File 2: pred B with a duplicate edge (same identity tuple) — should
    # collapse to one row in the merged output, last-write-wins.
    f2 = {
        "chain_edges": [
            {
                "source_prediction_id": "prediction.A",
                "downstream_prediction_id": "prediction.B",
                "via_evidence_id": "evidence.X",
                "strength": 0.9,
                "notes": "duplicate edge — strength updated",
            },
            {
                "source_prediction_id": "prediction.B",
                "downstream_prediction_id": "prediction.C",
                "via_evidence_id": None,
                "strength": 0.4,
                "notes": None,
            },
        ],
        "relations": [
            # Pair-swapped duplicate of f1's relation — same canonical
            # key after order-normalization, must dedupe.
            {
                "prediction_a": "prediction.B",
                "prediction_b": "prediction.A",
                "relation_type": "parallel",
                "family_id": None,
                "prob_mass": None,
                "notes": "swapped pair",
            }
        ],
        "cluster_pointers": [],
    }
    # File 3: pred C, fresh entries.
    f3 = {
        "chain_edges": [
            {
                "source_prediction_id": "prediction.C",
                "downstream_prediction_id": "prediction.D",
                "via_evidence_id": None,
                "strength": 0.6,
                "notes": None,
            }
        ],
        "relations": [
            {
                "prediction_a": "prediction.C",
                "prediction_b": "prediction.D",
                "relation_type": "negation",
                "family_id": None,
                "prob_mass": None,
                "notes": None,
            }
        ],
        "cluster_pointers": [
            {
                "prediction_id": "prediction.C",
                "cluster_keys": ["theme.y|2099-05"],
            }
        ],
    }
    (date_dir / "readings.prediction.A.json").write_text(
        json.dumps(f1), encoding="utf-8"
    )
    (date_dir / "readings.prediction.B.json").write_text(
        json.dumps(f2), encoding="utf-8"
    )
    (date_dir / "readings.prediction.C.json").write_text(
        json.dumps(f3), encoding="utf-8"
    )

    out = sb.merge_readings_files(date_dir)
    assert out == date_dir / "readings.json"
    merged = json.loads(out.read_text(encoding="utf-8"))

    # Date inferred from directory name.
    assert merged["date"] == SAMPLE_DATE

    # Chain edges deduped on (source, downstream, via). The duplicate
    # A→B|evidence.X collapses to one row; last-write-wins gives the
    # f2 strength + notes.
    edges = merged["chain_edges"]
    edge_keys = [
        (e["source_prediction_id"], e["downstream_prediction_id"],
         e["via_evidence_id"]) for e in edges
    ]
    assert len(edges) == 3
    assert edge_keys == sorted(set(edge_keys), key=edge_keys.index)
    a_b_edge = next(
        e for e in edges
        if e["source_prediction_id"] == "prediction.A"
        and e["downstream_prediction_id"] == "prediction.B"
    )
    assert abs(a_b_edge["strength"] - 0.9) < 1e-9
    assert a_b_edge["notes"] == "duplicate edge — strength updated"

    # Relations deduped on the unordered (a, b) pair + relation_type.
    # The pair-swapped A↔B parallel relation collapses to one entry.
    rels = merged["relations"]
    assert len(rels) == 2
    rel_types = sorted(r["relation_type"] for r in rels)
    assert rel_types == ["negation", "parallel"]

    # Cluster pointers indexed by prediction_id; no duplicates.
    cps = merged["cluster_pointers"]
    assert len(cps) == 2
    cp_pids = sorted(c["prediction_id"] for c in cps)
    assert cp_pids == ["prediction.A", "prediction.C"]

    # Merged file is itself ReadingsFile-valid.
    ReadingsFile.from_dict(merged)


def test_merge_readings_files_raises_when_no_sources(fake_repo: Path):
    """The merge step refuses to write an empty readings.json — the
    orchestrator must not call it before any sub-agent has produced
    output."""
    date_dir = fake_repo / "app" / "sourcedata" / SAMPLE_DATE
    date_dir.mkdir(parents=True)
    with pytest.raises(FileNotFoundError):
        sb.merge_readings_files(date_dir)


# ---------------------------------------------------------------------------
# 6. Idempotent re-ingest
# ---------------------------------------------------------------------------


def test_ingest_readings_idempotent(fake_repo: Path, conn: sqlite3.Connection):
    """Ingesting the same readings.json twice does not duplicate rows."""
    _seed_parent_rows(conn)
    payload = _valid_readings_payload()
    sb.apply_readings(fake_repo, SAMPLE_DATE, payload)
    ingest_day(conn, fake_repo, SAMPLE_DATE)
    n_chain_first = conn.execute(
        "SELECT COUNT(*) AS n FROM prediction_chain"
    ).fetchone()["n"]
    n_rel_first = conn.execute(
        "SELECT COUNT(*) AS n FROM prediction_relations"
    ).fetchone()["n"]
    assert n_chain_first == 2
    assert n_rel_first == 2

    # Second ingest of the unchanged JSON: row counts must hold.
    ingest_day(conn, fake_repo, SAMPLE_DATE)
    n_chain_second = conn.execute(
        "SELECT COUNT(*) AS n FROM prediction_chain"
    ).fetchone()["n"]
    n_rel_second = conn.execute(
        "SELECT COUNT(*) AS n FROM prediction_relations"
    ).fetchone()["n"]
    assert n_chain_second == n_chain_first
    assert n_rel_second == n_rel_first
