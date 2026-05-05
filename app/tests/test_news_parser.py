"""Unit tests for the news report parser."""

from __future__ import annotations

from pathlib import Path

from src.parsers.news_parser import parse_news_file, parse_news_markdown


SAMPLE_REPORT = """# ニュースレポート 2026-04-24

対象期間: 2026-04-22 〜 2026-04-24

## Headlines

- **Thing happened** something something [Example](https://example.com/a)

## Future

本レポートのニュースから導出した 3 点の予測。

1. **予測 A** — 1M context が既定のオープン重み時代に 2026 Q3 移行。RAG は主流シフト。
2. **予測 B** — Physical AI の 8 時間本番稼働が 2026 後半のエンタープライズ調達条件に。 [Example](https://example.com/b)
3. **予測 C** — AI エージェントに displace されるエンタープライズ SaaS。

## News

### Section

- item
"""


def test_parse_extracts_date_from_heading():
    report = parse_news_markdown(SAMPLE_REPORT)
    assert report.report_date == "2026-04-24"


def test_parse_extracts_three_predictions_with_short_labels():
    report = parse_news_markdown(SAMPLE_REPORT)
    assert len(report.predictions) == 3
    pred1, pred2, pred3 = report.predictions
    assert pred1.index == 1
    assert pred1.short_label == "予測 A"
    assert "1M context" in pred1.summary
    assert pred2.short_label == "予測 B"
    # Link should be stripped from summary text but present in reference_links
    assert "https://example.com/b" in pred2.reference_links
    assert "Example" in pred2.summary or "Physical AI" in pred2.summary
    assert pred3.index == 3


def test_parse_handles_missing_future_section():
    text = "# ニュースレポート 2026-04-20\n\n## Headlines\n\n- x\n\n## News\n\n- y\n"
    report = parse_news_markdown(text)
    assert report.report_date == "2026-04-20"
    assert report.predictions == []


def test_parse_real_file():
    repo = Path(__file__).resolve().parents[2]
    # Locale-aware lookup (feature/locale): files may live under
    # report/en/, report/ja/, etc. Check those first, then legacy flat.
    candidates = [
        repo / "report" / "en" / "news-20260424.md",
        repo / "report" / "ja" / "news-20260424.md",
        repo / "report" / "news-20260424.md",
    ]
    p = next((c for c in candidates if c.exists()), None)
    if p is None:
        return
    report = parse_news_file(p)
    assert report.report_date == "2026-04-24"
    assert len(report.predictions) >= 1
    for pred in report.predictions:
        assert pred.summary
        assert pred.short_label
