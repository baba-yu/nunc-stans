"""Tests for ``app.skills.super_backfill`` — chronological backfill walker."""

from __future__ import annotations

from app.skills import super_backfill as sb


def test_scan_markdown_dates_returns_union_sorted(tmp_path):
    """Every date with EN news OR EN FP appears, sorted ascending,
    with flags for which markdown exists."""
    (tmp_path / "report/en").mkdir(parents=True)
    (tmp_path / "future-prediction/en").mkdir(parents=True)
    for d in ("20260419", "20260420", "20260422", "20260423"):
        (tmp_path / f"report/en/news-{d}.md").write_text("x", encoding="utf-8")
    for d in ("20260422", "20260423"):
        (tmp_path / f"future-prediction/en/future-prediction-{d}.md").write_text(
            "x", encoding="utf-8"
        )
    out = sb.scan_markdown_dates(tmp_path)
    assert out == [
        ("2026-04-19", True, False),
        ("2026-04-20", True, False),
        ("2026-04-22", True, True),
        ("2026-04-23", True, True),
    ]


def test_scan_markdown_dates_empty_repo(tmp_path):
    assert sb.scan_markdown_dates(tmp_path) == []


def test_scan_markdown_dates_ignores_non_matching_files(tmp_path):
    (tmp_path / "report/en").mkdir(parents=True)
    (tmp_path / "report/en/news-20260419.md").write_text("x", encoding="utf-8")
    (tmp_path / "report/en/news-20260419.md.bak").write_text("x", encoding="utf-8")
    (tmp_path / "report/en/README.md").write_text("x", encoding="utf-8")
    out = sb.scan_markdown_dates(tmp_path)
    assert out == [("2026-04-19", True, False)]


# ---------------------------------------------------------------------------
# Task 3: extract_predictions_from_news
#
# Real markdown shape (confirmed against report/en/news-20260504.md):
#
#   ## Future
#
#
#   1. Title line, NOT bolded
#
#      **Body sentence first sentence in bold.** Continuing prose, possibly
#      multi-paragraph, with "In plain language: ..." tail markers.
#
#
#   2. Second title
#
#      ...
#
#   ## Change Log
# ---------------------------------------------------------------------------


def test_extract_predictions_from_news_real_format(tmp_path):
    md = (
        "# Daily News 2026-04-22\n\n"
        "## Quick Reads\n\n"
        "- A plain headline.\n\n"
        "## Headlines\n\n"
        "- **Lead** body.\n\n"
        "## Future\n\n\n"
        "1. Hyperscaler-partner enterprise-AI JV template publishes by Q4 2026\n\n"
        "   **By Q4 2026 the parallel-JV launch combined with policy pressure** "
        "forces ≥1 hyperscaler partner to ship a structurally analogous "
        "JV template. In plain language: clouds will copy the shape.\n\n\n"
        "2. Second prediction title here\n\n"
        "   **Body of the second prediction** with more prose.\n\n"
        "## Change Log\n\n"
        "- (changes)\n"
    )
    p = tmp_path / "news-20260422.md"
    p.write_text(md, encoding="utf-8")
    out = sb.extract_predictions_from_news(p)
    assert len(out) == 2
    assert (
        out[0]["title"]
        == "Hyperscaler-partner enterprise-AI JV template publishes by Q4 2026"
    )
    assert out[0]["body"].startswith("**By Q4 2026")
    assert "In plain language" in out[0]["body"]
    assert out[1]["title"] == "Second prediction title here"
    assert "Body of the second prediction" in out[1]["body"]


def test_extract_predictions_handles_no_future_section(tmp_path):
    p = tmp_path / "news-20260419.md"
    p.write_text(
        "# Daily News 2026-04-19\n\n## News\n\n- bullet.\n",
        encoding="utf-8",
    )
    assert sb.extract_predictions_from_news(p) == []


def test_extract_predictions_strips_leading_indent_from_body(tmp_path):
    """Real corpus indents body lines by 3 spaces; extractor returns clean prose."""
    md = (
        "## Future\n\n\n"
        "1. T1\n\n"
        "   line1\n"
        "   line2\n\n"
        "## Change Log\n"
    )
    p = tmp_path / "news-20260422.md"
    p.write_text(md, encoding="utf-8")
    out = sb.extract_predictions_from_news(p)
    assert len(out) == 1
    body = out[0]["body"]
    assert "line1" in body and "line2" in body
    # Leading indent on each line is stripped — no body line starts with spaces.
    for line in body.splitlines():
        if line:
            assert not line.startswith(" "), f"unstripped indent: {line!r}"
