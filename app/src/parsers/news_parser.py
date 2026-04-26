"""Parse ``report/news-YYYYMMDD.md`` files.

The parser is resilient to formatting drift: missing sections, occasional
code fences, and Japanese text mixed with inline Markdown links. The
output is deliberately simple — structured dicts the ingest layer
converts into DB rows.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path


FILENAME_RE = re.compile(r"news-(\d{8})\.md$")
DATE_HEADER_RE = re.compile(r"#\s*ニュースレポート\s*(\d{4}-\d{2}-\d{2})")
SECTION_RE = re.compile(r"^##\s+(.+?)\s*$", re.MULTILINE)
# Markdown link: [title](url)
LINK_RE = re.compile(r"\[([^\]]+)\]\((https?://[^\s)]+)\)")
# Numbered list entry at the beginning of a (possibly multi-line) paragraph.
# We intentionally capture the rest of the line plus any continuation lines
# until the next numbered item or a blank separator.
NUMBERED_ITEM_RE = re.compile(
    r"^\s*(\d+)\.\s+(.*?)(?=^\s*\d+\.\s+|\Z)",
    re.MULTILINE | re.DOTALL,
)
# Bold title in the form **title**
BOLD_RE = re.compile(r"\*\*([^*]+)\*\*")


@dataclass
class PredictionSummary:
    """Numbered item from the ``## Future`` section."""

    index: int
    summary: str  # plain text w/o markdown link clutter
    short_label: str
    raw_markdown: str
    reference_links: list[str] = field(default_factory=list)


@dataclass
class NewsReport:
    path: Path
    report_date: str  # ISO YYYY-MM-DD
    predictions: list[PredictionSummary]
    raw_sections: dict[str, str]


def _strip_links(text: str) -> str:
    """Replace ``[title](url)`` with ``title``."""
    return LINK_RE.sub(lambda m: m.group(1), text)


def _extract_links(text: str) -> list[str]:
    return [m.group(2) for m in LINK_RE.finditer(text)]


def _split_sections(markdown: str) -> dict[str, str]:
    """Split top-level ``## heading`` sections. Returns {heading: body}."""
    sections: dict[str, str] = {}
    positions: list[tuple[str, int, int]] = []
    for match in SECTION_RE.finditer(markdown):
        positions.append((match.group(1).strip(), match.start(), match.end()))
    for i, (heading, _start, end) in enumerate(positions):
        body_start = end
        body_end = positions[i + 1][1] if i + 1 < len(positions) else len(markdown)
        sections[heading] = markdown[body_start:body_end].strip()
    return sections


def _derive_short_label(summary: str, bold_hint: str | None, fallback_idx: int) -> str:
    """Pick a concise label for the prediction."""
    base = bold_hint or summary
    # Squash whitespace and strip surrounding punctuation.
    base = re.sub(r"\s+", " ", base).strip(" 　—-:：「」『』\"'()[]{}")
    # Prefer first clause before a punctuation break.
    for sep in ("—", "――", " - ", "。", "、", "："):
        if sep in base:
            base = base.split(sep, 1)[0].strip()
            break
    if not base:
        base = f"Prediction {fallback_idx}"
    if len(base) > 40:
        base = base[:39].rstrip() + "…"
    return base


def parse_news_markdown(markdown: str, *, source_path: Path | str | None = None) -> NewsReport:
    """Parse news-report Markdown text into a :class:`NewsReport`."""
    path = Path(source_path) if source_path else Path("<memory>")

    # Date: prefer the ``# ニュースレポート YYYY-MM-DD`` heading, fall back
    # to the filename, fall back to empty.
    report_date = ""
    header = DATE_HEADER_RE.search(markdown)
    if header:
        report_date = header.group(1)
    elif source_path:
        m = FILENAME_RE.search(str(source_path))
        if m:
            d = m.group(1)
            report_date = f"{d[0:4]}-{d[4:6]}-{d[6:8]}"

    sections = _split_sections(markdown)
    future_body = sections.get("Future", "")

    predictions: list[PredictionSummary] = []
    if future_body:
        for item_match in NUMBERED_ITEM_RE.finditer(future_body):
            idx = int(item_match.group(1))
            body = item_match.group(2).strip()
            # Look for **bold title** up front for short_label.
            bold_hint = None
            bold = BOLD_RE.search(body)
            if bold:
                bold_hint = bold.group(1).strip()
            summary = _strip_links(body).strip()
            # Collapse runs of whitespace.
            summary = re.sub(r"\s+", " ", summary)
            short_label = _derive_short_label(summary, bold_hint, idx)
            predictions.append(
                PredictionSummary(
                    index=idx,
                    summary=summary,
                    short_label=short_label,
                    raw_markdown=body,
                    reference_links=_extract_links(body),
                )
            )

    return NewsReport(
        path=path,
        report_date=report_date,
        predictions=predictions,
        raw_sections=sections,
    )


def parse_news_file(path: Path | str) -> NewsReport:
    p = Path(path)
    # errors="replace": tolerate truncated / mis-encoded tails (some files
    # arrive from git history with an incomplete trailing UTF-8 sequence).
    text = p.read_bytes().decode("utf-8", errors="replace")
    return parse_news_markdown(text, source_path=p)
