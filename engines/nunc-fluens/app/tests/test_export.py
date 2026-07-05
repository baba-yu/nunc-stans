"""Integration test for the export layer."""

from __future__ import annotations

import json
import shutil
import sqlite3
from pathlib import Path

import pytest

from src import db, export, ingest, score


REPO = Path(__file__).resolve().parents[2]


@pytest.fixture()
def temp_db_and_export(tmp_path: Path):
    db_path = tmp_path / "analytics.sqlite"
    # init schema
    db.init_db(db_path)
    # Stage only the 2026-04-24 files so the ingest has predictable input.
    # ingest uses repo_root() / report/ and future-prediction/, so we
    # simply keep those in place and point a custom DB. The real sample
    # files already exist in the repo.
    yield db_path, tmp_path


def _run_pipeline(db_path: Path, out_dir: Path) -> None:
    conn = sqlite3.connect(str(db_path))
    conn.close()
    ingest.run_ingest(db_path)
    score.run_score(db_path)
    export.run_export(output_dir=out_dir, db_path=db_path)


def test_end_to_end_tech_graph(temp_db_and_export):
    db_path, tmp_path = temp_db_and_export
    out_dir = tmp_path / "data"
    _run_pipeline(db_path, out_dir)

    assert (out_dir / "manifest.json").exists()
    assert (out_dir / "graph-tech.json").exists()
    assert (out_dir / "graph-business.json").exists()

    tech = json.loads((out_dir / "graph-tech.json").read_text(encoding="utf-8"))
    # Required top-level keys
    for key in (
        "schema_version",
        "scope_id",
        "scope_label",
        "generated_at",
        "date_range",
        "windows",
        "nodes",
        "links",
        "legend",
    ):
        assert key in tech, f"graph-tech.json missing {key}"
    assert tech["scope_id"] == "tech"
    assert set(tech["windows"].keys()) == {"7d", "30d", "90d"}

    # Every node has 7d/30d/90d metrics with required shape.
    required_metric_keys = {
        "attention_score",
        "realization_score",
        "contradiction_score",
        "grass_level",
        "streak_days",
        "new_signal",
        "continuing_signal",
        "status",
    }
    assert tech["nodes"], "graph-tech.json should have nodes"
    node_ids = set()
    for node in tech["nodes"]:
        node_ids.add(node["id"])
        assert node["type"] in ("category", "theme", "subtheme", "prediction")
        for win in ("7d", "30d", "90d"):
            assert win in node["metrics_by_window"], f"node {node['id']} missing {win}"
            bundle = node["metrics_by_window"][win]
            missing = required_metric_keys - set(bundle.keys())
            assert not missing, f"node {node['id']} {win} missing {missing}"

    # Every link's source and target exists as a node.
    for link in tech["links"]:
        assert link["source"] in node_ids, f"link source {link['source']} missing"
        assert link["target"] in node_ids, f"link target {link['target']} missing"
        assert link["type"] in (
            "contains", "supports", "contradicts", "related", "derived_from",
            "shares_prediction",
        )


def test_manifest_shape(temp_db_and_export):
    db_path, tmp_path = temp_db_and_export
    out_dir = tmp_path / "data"
    _run_pipeline(db_path, out_dir)
    manifest = json.loads((out_dir / "manifest.json").read_text(encoding="utf-8"))
    for key in (
        "schema_version",
        "build_id",
        "latest_report_date",
        "default_scope",
        "default_window",
        "windows",
        "scopes",
    ):
        assert key in manifest, f"manifest missing {key}"
    window_ids = {w["window_id"] for w in manifest["windows"]}
    assert window_ids == {"7d", "30d", "90d"}
    scope_ids = {s["scope_id"] for s in manifest["scopes"]}
    assert scope_ids == {"tech", "business", "mix"}


def test_prediction_nodes_include_evidence(temp_db_and_export):
    db_path, tmp_path = temp_db_and_export
    out_dir = tmp_path / "data"
    _run_pipeline(db_path, out_dir)
    tech = json.loads((out_dir / "graph-tech.json").read_text(encoding="utf-8"))
    pred_nodes = [n for n in tech["nodes"] if n["type"] == "prediction"]
    # Prediction node details should expose evidence entries where available.
    assert pred_nodes, "expected at least one prediction node"
    with_evidence = [n for n in pred_nodes if n["detail"].get("evidence")]
    # Not every prediction has evidence but at least one should.
    assert with_evidence, "expected at least one prediction with evidence"
    ev = with_evidence[0]["detail"]["evidence"][0]
    for key in ("evidence_id", "url", "support_direction", "validation_date"):
        assert key in ev


def test_manifest_carries_locales(temp_db_and_export):
    """feature/locale: manifest must declare locales + default_locale."""
    db_path, tmp_path = temp_db_and_export
    out_dir = tmp_path / "data"
    _run_pipeline(db_path, out_dir)
    manifest = json.loads((out_dir / "manifest.json").read_text(encoding="utf-8"))
    assert manifest.get("locales") == ["en", "ja", "es", "fil"], (
        f"manifest.locales should be the 4 supported codes, got {manifest.get('locales')!r}"
    )
    assert manifest.get("default_locale") == "en"


def test_theme_node_has_all_locale_keys(temp_db_and_export):
    """feature/locale: every theme node carries labels.{en,ja,es,fil}.

    Per-field fallback: NULL DB locale values are emitted as the EN
    value so the frontend can index without a guard.
    """
    db_path, tmp_path = temp_db_and_export
    out_dir = tmp_path / "data"
    _run_pipeline(db_path, out_dir)
    tech = json.loads((out_dir / "graph-tech.json").read_text(encoding="utf-8"))
    theme_nodes = [n for n in tech["nodes"] if n["type"] == "theme"]
    assert theme_nodes, "expected at least one theme node"
    for tn in theme_nodes:
        labels = tn.get("labels")
        assert isinstance(labels, dict), f"theme {tn['id']} missing labels dict"
        for field in ("label", "short_label", "description"):
            sub = labels.get(field)
            assert isinstance(sub, dict), f"theme {tn['id']} labels.{field} not a dict"
            assert set(sub.keys()) == {"en", "ja", "es", "fil"}, (
                f"theme {tn['id']} labels.{field} keys = {set(sub.keys())}"
            )