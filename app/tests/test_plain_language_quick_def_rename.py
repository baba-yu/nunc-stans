"""End-to-end checks for the eli14 → plain_language / one_liner_eli14 → quick_def rename.

PROBE in the dashboard has two tabs: PREDICTIONS and NEWS. This test asserts
that the rename did not break either surface:

  * PREDICTIONS — graph-*.json exposes a prediction's plain-language summary
    under `detail.reasoning.plain_language` (scalar) and
    `detail.reasoning_locales.plain_language` (locale dict).
    The legacy `eli14` key MUST NOT appear anywhere in the export.

  * NEWS — the rendered news markdown shows the prediction's plain-language
    sentence under the human-readable "In plain language: ..." prose
    surface (the renderer never emits `eli14` or `plain_language` as a
    bullet key).

  * Glossary — glossary.json uses `quick_def` (EN scalar) and
    `quick_def_locales` (locale dict). The legacy `one_liner_eli14` and
    locale-dict-keyed-as-`eli14` shapes MUST NOT appear.
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

import pytest

from src import db, export, ingest, score


REPO = Path(__file__).resolve().parents[2]


@pytest.fixture()
def end_to_end_export(tmp_path: Path):
    """Run the full ingest → score → export pipeline and yield the output dir."""
    db_path = tmp_path / "analytics.sqlite"
    db.init_db(db_path)
    ingest.run_ingest(db_path)
    score.run_score(db_path)
    out_dir = tmp_path / "data"
    export.run_export(output_dir=out_dir, db_path=db_path)
    yield db_path, out_dir


def _all_keys(node) -> set[str]:
    """Recursively collect all dict keys appearing anywhere in `node`."""
    keys: set[str] = set()
    if isinstance(node, dict):
        keys.update(node.keys())
        for v in node.values():
            keys.update(_all_keys(v))
    elif isinstance(node, list):
        for v in node:
            keys.update(_all_keys(v))
    return keys


def test_graph_predictions_use_plain_language_not_eli14(end_to_end_export):
    """Every prediction node's reasoning surfaces the new key, not the legacy one."""
    _, out_dir = end_to_end_export
    for scope in ("tech", "business", "mix"):
        graph = json.loads((out_dir / f"graph-{scope}.json").read_text(encoding="utf-8"))
        keys = _all_keys(graph)
        assert "eli14" not in keys, (
            f"graph-{scope}.json still contains the legacy `eli14` key "
            f"somewhere — rename incomplete. All keys present: {sorted(keys)[:20]}..."
        )
        # Every prediction node must carry the new key in both the EN
        # scalar `reasoning` block and the `reasoning_locales` block,
        # even when the underlying value is empty.
        pred_nodes = [n for n in graph["nodes"] if n["type"] == "prediction"]
        for pn in pred_nodes:
            reasoning = pn["detail"].get("reasoning") or {}
            assert "plain_language" in reasoning, (
                f"prediction {pn['id']} in {scope} missing detail.reasoning.plain_language"
            )
            rloc = pn["detail"].get("reasoning_locales") or {}
            assert "plain_language" in rloc, (
                f"prediction {pn['id']} in {scope} missing detail.reasoning_locales.plain_language"
            )


def test_glossary_export_uses_quick_def(end_to_end_export):
    """`docs/data/glossary.json` ships `quick_def` + `quick_def_locales`, no eli14."""
    _, out_dir = end_to_end_export
    g = json.loads((out_dir / "glossary.json").read_text(encoding="utf-8"))
    assert "terms" in g
    if not g["terms"]:
        pytest.skip("no active glossary terms in this corpus snapshot")
    for entry in g["terms"]:
        # Forbidden legacy keys at any nesting level.
        keys = _all_keys(entry)
        for legacy in ("eli14", "one_liner_eli14"):
            assert legacy not in keys, (
                f"glossary entry {entry.get('term')!r} still exposes legacy key "
                f"{legacy!r} — rename incomplete. Keys: {sorted(keys)}"
            )
        # New keys must be present (back-compat flat field + locale dict).
        assert "quick_def" in entry, f"{entry.get('term')!r} missing `quick_def`"
        assert "quick_def_locales" in entry, (
            f"{entry.get('term')!r} missing `quick_def_locales`"
        )
        # Locale dict must have all 4 supported locales (NULL fan-out
        # to EN at export time means each key is a non-None string).
        locales = entry["quick_def_locales"]
        assert set(locales.keys()) == {"en", "ja", "es", "fil"}, (
            f"{entry.get('term')!r} locale dict has unexpected keys: {set(locales.keys())}"
        )


def test_news_markdown_renders_plain_language_prose(tmp_path: Path):
    """The rendered news markdown surfaces the plain-language sentence as
    `In plain language: ...` prose — never as the field-name keyword.
    """
    from skills import render_news_md, ingest_sourcedata

    # Pick a recent date that has full sourcedata committed.
    sd_root = REPO / "app" / "sourcedata"
    candidate_dates = sorted(
        (p.name for p in sd_root.iterdir() if p.is_dir() and p.name[0].isdigit()),
        reverse=True,
    )
    assert candidate_dates, "no sourcedata directories found under app/sourcedata/"
    date_iso = candidate_dates[0]

    md = render_news_md.render_day(REPO, date_iso, "en")
    # Either a prediction with a non-empty plain_language or none at all
    # — but if any prediction in this date has plain_language content,
    # the renderer must surface it as `In plain language: ...` prose
    # and must never leak the field name as a bullet key.
    pred_json = json.loads(
        (sd_root / date_iso / "predictions.json").read_text(encoding="utf-8")
    )
    has_plain = any(
        (p.get("reasoning", {}).get("plain_language") or "").strip()
        for p in pred_json.get("predictions", [])
    )
    if has_plain:
        assert "In plain language:" in md, (
            "expected the `In plain language:` prose surface in rendered news.md"
        )
    # Field-name leakage is forbidden in user-facing markdown.
    assert "plain_language" not in md, (
        "rendered news.md leaked the internal field name `plain_language`"
    )
    assert "eli14" not in md.lower(), (
        "rendered news.md leaked the legacy field name `eli14`"
    )
    # Bullet-key leakage is forbidden.
    assert "- plain_language:" not in md
    assert "- eli14:" not in md


def test_db_columns_renamed(end_to_end_export):
    """The migrated DB has the new column names and not the legacy ones."""
    db_path, _ = end_to_end_export
    conn = sqlite3.connect(db_path)
    try:
        pred_cols = {r[1] for r in conn.execute("PRAGMA table_info(predictions)").fetchall()}
        gloss_cols = {r[1] for r in conn.execute("PRAGMA table_info(glossary_terms)").fetchall()}
    finally:
        conn.close()
    # New columns present.
    for col in ("plain_language", "plain_language_ja", "plain_language_es", "plain_language_fil"):
        assert col in pred_cols, f"predictions.{col} missing"
    for col in ("quick_def", "quick_def_ja", "quick_def_es", "quick_def_fil"):
        assert col in gloss_cols, f"glossary_terms.{col} missing"
    # Legacy columns absent.
    for col in ("eli14", "eli14_ja", "eli14_es", "eli14_fil"):
        assert col not in pred_cols, f"legacy predictions.{col} still present"
    for col in ("one_liner_eli14", "one_liner_eli14_ja", "one_liner_eli14_es", "one_liner_eli14_fil"):
        assert col not in gloss_cols, f"legacy glossary_terms.{col} still present"
