"""Render round-trip + lint tests for the Phase 3 sourcedata flow.

Covers:

  * Synthetic sourcedata JSON → rendered markdown → lint passes (clean).
  * Rendered markdown contains the prediction's title + body prose
    while NOT carrying any forbidden internal-pipeline tokens.
  * lint_markdown_clean correctly FLAGS the legacy mixed-format
    markdown (the existing 2026-05-04 corpus) so the gate works as
    advertised.
  * extract_needs.merge_needs_files combines per-prediction temp
    files into a single ``needs.json`` matching the schema.
  * Round-trip: rendered markdown contains every prediction's title
    so a future markdown-side reader can still find them by title.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

# Skip the whole file if jinja2 isn't installed — the renderer requires
# it but the rest of the test suite (legacy markdown path) does not.
jinja2 = pytest.importorskip("jinja2")  # noqa: F841

from app.skills import lint_markdown_clean
from app.skills.extract_needs import merge_needs_files
from app.skills.render_news_md import render_day as render_news


REPO_ROOT_REAL = Path(__file__).resolve().parents[2]
SAMPLE_DATE = "2099-01-01"


def _write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
    )


# ---------------------------------------------------------------------------
# Synthetic-corpus fixture
# ---------------------------------------------------------------------------


@pytest.fixture()
def fake_repo(tmp_path: Path) -> Path:
    """Stand up a fake repo under tmp with the four sourcedata streams."""
    base = tmp_path / "app" / "sourcedata" / SAMPLE_DATE
    _write_json(
        base / "predictions.json",
        {
            "date": SAMPLE_DATE,
            "predictions": [
                {
                    "id": "prediction.demo01",
                    "title": "Demo prediction title",
                    "body": (
                        "Demo prediction body — long-form prose explaining "
                        "what the prediction is and why it lands by Q4 2099."
                    ),
                    "reasoning": {
                        "because": "observed precondition",
                        "given": "structural force",
                        "so_that": "consequence",
                        "landing": "by Q4 2099",
                        "plain_language": (
                            "in plain English, the demo thing happens"
                        ),
                    },
                    "summary": (
                        "mid-tier summary, ~200 chars of plain technical prose."
                    ),
                },
            ],
        },
    )
    _write_json(
        base / "headlines.json",
        {
            "date": SAMPLE_DATE,
            "technical": [
                {
                    "lead": "Demo lead",
                    "body": "Technical body sentence carrying the citation.",
                    "citations": [
                        {"label": "Demo source", "url": "https://example.com/a"}
                    ],
                }
            ],
            "plain": ["Demo plain headline 1", "Demo plain headline 2"],
        },
    )
    _write_json(
        base / "change_log.json",
        {
            "date": SAMPLE_DATE,
            "vs_date": "2098-12-31",
            "items": [
                {
                    "kind": "new",
                    "headline": "New thing today",
                    "diff_narrative": (
                        "Yesterday's report did not have this; today it does."
                    ),
                }
            ],
        },
    )
    _write_json(
        base / "news_section.json",
        {
            "date": SAMPLE_DATE,
            "sections": [
                {
                    "category": "Demo Category",
                    "bullets": [
                        {
                            "body": "Demo bullet body with embedded citation.",
                            "citations": [
                                {
                                    "label": "Source one",
                                    "url": "https://example.com/b",
                                }
                            ],
                        }
                    ],
                }
            ],
        },
    )
    return tmp_path


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_render_news_clean(fake_repo: Path):
    """Synthetic corpus renders to markdown with the title + body intact."""
    md = render_news(fake_repo, SAMPLE_DATE, "en")
    # Header + AI notice present.
    assert md.startswith(f"# News Report {SAMPLE_DATE}\n")
    assert "<!-- ai-notice -->" in md
    # Renamed sections present.
    assert "## Quick Reads\n" in md
    assert "## Headlines\n" in md
    assert "## Future\n" in md
    assert "## Change Log\n" in md
    assert "## News\n" in md
    # The prediction title + body are rendered.
    assert "Demo prediction title" in md
    assert "Demo prediction body" in md
    # The plain-language sentence is rendered as a separate paragraph
    # using the "In plain language: …" prefix instead of `plain_language:`.
    assert "In plain language: in plain English" in md


def test_render_news_lint_clean(fake_repo: Path, tmp_path: Path):
    """Rendered output passes lint_markdown_clean (no forbidden tokens)."""
    md = render_news(fake_repo, SAMPLE_DATE, "en")
    out = tmp_path / "synthetic.md"
    out.write_text(md, encoding="utf-8")
    rc = lint_markdown_clean.lint_paths([out])
    assert rc == 0, "renderer leaked a forbidden token"


@pytest.mark.parametrize(
    "needle",
    [
        "plain_language",
        "JTBD",
        "Stream J",
        "Pred ID #1",
        "**Summary:**",
        "Coherence 4/5",
        "Remaining gap:",
        "- because: foo",
        "- given: foo",
        "- so_that: foo",
        "- landing: foo",
        "- plain_language: foo",
        "(Tech) prefix",
    ],
)
def test_lint_catches_forbidden_tokens(tmp_path: Path, needle: str):
    """Sanity check: the lint catches every forbidden-token category."""
    out = tmp_path / "tainted.md"
    # Wrap the needle inside a structurally complete markdown body so the
    # lint isn't tripping on something else.
    out.write_text(
        f"# Test report\n\nSome prose.\n\n{needle}\n\n## Section\n\nMore.\n",
        encoding="utf-8",
    )
    rc = lint_markdown_clean.lint_paths([out])
    assert rc == 1, f"lint failed to catch forbidden token: {needle!r}"


def test_lint_flags_legacy_corpus():
    """Confirm the lint catches contamination in a synthesized legacy file.

    Phase 3 only adds the gate; Phase 4 cleans the corpus. Since the
    on-disk 2026-05-04 file has now been regenerated by Phase 4, we
    instead build a synthetic file that mirrors the legacy mixed-
    format shape (plain_language bullets, **Summary:** anchors, scope-prefix
    leakage) and confirm the gate fires on it.
    """
    legacy_shape = (
        "# News Report 2099-12-31\n\n"
        "## Future\n\n"
        "1. (Tech) Some legacy prediction title\n\n"
        "   - because: observed precondition\n"
        "   - given: structural force\n"
        "   - so_that: consequence\n"
        "   - landing: by Q4 2099\n"
        "   - plain_language: in plain language thingy\n\n"
        "   **Summary:** legacy mid-tier prose anchor.\n\n"
        "   Body prose with Stream J reference.\n"
    )
    import tempfile

    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".md", delete=False, encoding="utf-8"
    ) as tf:
        tf.write(legacy_shape)
        path = Path(tf.name)
    try:
        rc = lint_markdown_clean.lint_paths([path])
    finally:
        path.unlink(missing_ok=True)
    assert rc == 1, (
        "expected lint to FAIL on synthetic legacy mixed-format markdown "
        "(plain_language, **Summary:**, etc.) — the gate may be too lenient."
    )


def test_merge_needs_files(tmp_path: Path):
    """Per-prediction temp files merge into a deterministic needs.json."""
    date_dir = tmp_path / "app" / "sourcedata" / SAMPLE_DATE
    date_dir.mkdir(parents=True)
    # Two per-prediction files; one bare-list shape, one explicit dict.
    _write_json(
        date_dir / "needs.prediction.demo01.json",
        [{"actor": "actor one", "job": "drive thing one"}],
    )
    (date_dir / "needs.prediction.demo02.json").write_text(
        json.dumps(
            {
                "prediction_id": "prediction.demo02",
                "needs": [{"actor": "actor two", "job": "drive thing two"}],
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    out = merge_needs_files(date_dir)
    assert out == date_dir / "needs.json"
    merged = json.loads(out.read_text(encoding="utf-8"))
    assert merged["date"] == SAMPLE_DATE
    assert set(merged["by_prediction"].keys()) == {
        "prediction.demo01",
        "prediction.demo02",
    }
    assert (
        merged["by_prediction"]["prediction.demo01"][0]["actor"] == "actor one"
    )
    assert (
        merged["by_prediction"]["prediction.demo02"][0]["actor"] == "actor two"
    )

    # Ingest contract: the merged file validates against the NeedsFile schema.
    from app.skills.sourcedata_schemas import NeedsFile

    NeedsFile.from_dict(merged)


def test_render_news_handles_missing_streams(tmp_path: Path):
    """Missing input JSONs render to empty sections without crashing."""
    fake = tmp_path
    (fake / "app" / "sourcedata" / SAMPLE_DATE).mkdir(parents=True)
    md = render_news(fake, SAMPLE_DATE, "en")
    # Section headers still present.
    assert "## Quick Reads\n" in md
    assert "## Future\n" in md
    # Lint stays clean even on a near-empty render.
    out = tmp_path / "empty.md"
    out.write_text(md, encoding="utf-8")
    assert lint_markdown_clean.lint_paths([out]) == 0
