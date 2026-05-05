"""Chronological markdown-rooted backfill for ``app/sourcedata/``.

Spec: ``design/skills/super-backfill.md``.

Walks ``report/<L>/news-YYYYMMDD.md`` and
``future-prediction/<L>/future-prediction-YYYYMMDD.md`` oldest-to-newest,
regenerating LLM-derived structured fields into the canonical JSON
sourcedata. Each date stage is atomic; mid-walk failure leaves prior
dates intact and re-runnable.

The Python module is the deterministic half: markdown extraction,
context bundling, schema-validating atomic writes, DB ingest. The LLM
fills happen at the parent-agent level (Claude dispatches one sub-agent
per (date, stream, item) per the operator runbook in
``design/skills/super-backfill.md``).
"""

from __future__ import annotations

import re
from pathlib import Path

_NEWS_RE = re.compile(r"^news-(\d{8})\.md$")
_FP_RE = re.compile(r"^future-prediction-(\d{8})\.md$")


def _yyyymmdd_to_iso(s: str) -> str:
    return f"{s[:4]}-{s[4:6]}-{s[6:8]}"


def scan_markdown_dates(repo_root: Path) -> list[tuple[str, bool, bool]]:
    """Return ``[(date_iso, has_news, has_fp), ...]`` sorted ascending.

    Includes any date that has at least one EN markdown (news or FP).
    """
    repo_root = Path(repo_root)
    news_dates: set[str] = set()
    fp_dates: set[str] = set()
    news_dir = repo_root / "report" / "en"
    if news_dir.is_dir():
        for p in news_dir.iterdir():
            m = _NEWS_RE.match(p.name)
            if m:
                news_dates.add(_yyyymmdd_to_iso(m.group(1)))
    fp_dir = repo_root / "future-prediction" / "en"
    if fp_dir.is_dir():
        for p in fp_dir.iterdir():
            m = _FP_RE.match(p.name)
            if m:
                fp_dates.add(_yyyymmdd_to_iso(m.group(1)))
    all_dates = sorted(news_dates | fp_dates)
    return [(d, d in news_dates, d in fp_dates) for d in all_dates]
