"""Unit tests for the prediction validation parser."""

from __future__ import annotations

from pathlib import Path

from src.parsers.prediction_parser import parse_prediction_file, parse_prediction_markdown


SAMPLE_TABLE = """# Future Prediction Validation Report 2026-04-24

## Checking Predictions Against Reality

| Prediction (summary) | Prediction date | Related item(s) in today's report | Relevance (1-5) | Reference link(s) |
|---|---|---|---|---|
| 1-bit ネイティブ学習がエッジ LLM の標準になる | 2026-04-19 | **PrismML Bonsai-8B** が 1-bit 実装を Apple Silicon で提供。 | 3 | [HF - prism-ml/Bonsai-8B-mlx-1bit](https://huggingface.co/prism-ml/Bonsai-8B-mlx-1bit) |
| Agent Registry 方式への収斂 | 2026-04-19 | **Okta for AI Agents**（Apr 30 GA）登場。 | 5 | [Okta Blog](https://www.okta.com/blog/ai/okta-ai-agents-early-access-announcement/) |
| Headless Everything アーキテクチャが標準化 | 2026-04-20 | 本日の報告にこの論点の直接展開は見当たらず。 | 1 | （該当なし） |
"""


def test_parses_three_validation_rows():
    report = parse_prediction_markdown(SAMPLE_TABLE)
    assert report.validation_date == "2026-04-24"
    assert len(report.rows) == 3


def test_extracts_relevance_and_prediction_date():
    report = parse_prediction_markdown(SAMPLE_TABLE)
    row = report.rows[0]
    assert row.prediction_date == "2026-04-19"
    assert row.observed_relevance == 3
    assert "1-bit" in row.prediction_summary


def test_extracts_reference_links():
    report = parse_prediction_markdown(SAMPLE_TABLE)
    row = report.rows[1]
    assert row.observed_relevance == 5
    assert len(row.reference_links) == 1
    assert row.reference_links[0].url.startswith("https://www.okta.com")


def test_handles_no_reference_links():
    report = parse_prediction_markdown(SAMPLE_TABLE)
    row = report.rows[2]
    assert row.observed_relevance == 1
    assert row.reference_links == []
    assert "Headless" in row.prediction_summary


def test_parse_real_file():
    repo = Path(__file__).resolve().parents[2]
    p = repo / "future-prediction" / "future-prediction-20260424.md"
    if not p.exists():
        return
    report = parse_prediction_file(p)
    assert report.validation_date == "2026-04-24"
    # Real file has ~14 rows.
    assert len(report.rows) >= 5
    for row in report.rows:
        assert row.prediction_summary
        assert row.observed_relevance is None or 1 <= row.observed_relevance <= 5
