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
