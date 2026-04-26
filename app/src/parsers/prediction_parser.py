"""Parse ``future-prediction/future-prediction-YYYYMMDD.md`` files.

Each report contains a single Markdown table with the columns::

    Prediction (summary) | Prediction date | Related item(s) | Relevance | Reference link(s)

We extract each body row as a :class:`ValidationRow`, plus the contained
reference links as :class:`EvidenceItem` entries.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path


FILENAME_RE = re.compile(r"future-prediction-(\d{8})\.md$")
DATE_HEADER_RE = re.compile(
    r"#\s*Future Prediction Validation Report\s*(\d{4}-\d{2}-\d{2})"
)
LINK_RE = re.compile(r"\[([^\]]+)\]\((https?://[^\s)]+)\)")
RELEVANCE_RE = re.compile(r"(?<!\d)([1-5])(?!\d)")


@dataclass
class EvidenceItem:
    url: str
    title: str | None = None


@dataclass
class ValidationRow:
    prediction_summary: str
    prediction_date: str  # ISO YYYY-MM-DD or "" if unknown
    related_items_text: str
    observed_relevance: int | None
    reference_links: list[EvidenceItem] = field(default_factory=list)
    raw_row_markdown: str = ""


@dataclass
class ValidationReport:
    path: Path
    validation_date: str
    rows: list[ValidationRow]


def _normalize_date(text: str) -> str:
    m = re.search(r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})", text)
    if not m:
        return ""
    y, mo, d = m.group(1), m.group(2).zfill(2), m.group(3).zfill(2)
    return f"{y}-{mo}-{d}"


def _extract_links(cell: str) -> list[EvidenceItem]:
    out: list[EvidenceItem] = []
    seen: set[str] = set()
    for match in LINK_RE.finditer(cell):
        url = match.group(2).strip()
        if url in seen:
            continue
        seen.add(url)
        out.append(EvidenceItem(url=url, title=match.group(1).strip()))
    return out


def _strip_links(text: str) -> str:
    return LINK_RE.sub(lambda m: m.group(1), text)


def _parse_relevance(cell: str) -> int | None:
    """Return the first integer 1-5 appearing in the cell, else None."""
    plain = _strip_links(cell)
    m = RELEVANCE_RE.search(plain)
    if not m:
        return None
    return int(m.group(1))


def _find_pipe_table(markdown: str) -> list[str]:
    """Return the lines of the first pipe table that looks like the
    validation table. A pipe table is a consecutive run of lines that
    start with ``|``. We pick the first block with at least 3 rows."""
    lines = markdown.splitlines()
    blocks: list[list[str]] = []
    current: list[str] = []
    for line in lines:
        if line.lstrip().startswith("|"):
            current.append(line)
        else:
            if current:
                blocks.append(current)
                current = []
    if current:
        blocks.append(current)
    # Pick the first block that has a header/separator/body (>=3 rows).
    for block in blocks:
        if len(block) >= 3:
            return block
    return []


def _split_row(line: str) -> list[str]:
    """Split a pipe-delimited row into cells, tolerating escaped pipes."""
    # Remove leading/trailing pipes, keep the body.
    body = line.strip()
    if body.startswith("|"):
        body = body[1:]
    if body.endswith("|"):
        body = body[:-1]
    # Simple split — the source tables in this project don't use escaped
    # pipes inside cells.
    return [c.strip() for c in body.split("|")]


def parse_prediction_markdown(
    markdown: str, *, source_path: Path | str | None = None
) -> ValidationReport:
    """Parse a future-prediction validation Markdown file."""
    path = Path(source_path) if source_path else Path("<memory>")

    validation_date = ""
    header = DATE_HEADER_RE.search(markdown)
    if header:
        validation_date = header.group(1)
    elif source_path:
        m = FILENAME_RE.search(str(source_path))
        if m:
            d = m.group(1)
            validation_date = f"{d[0:4]}-{d[4:6]}-{d[6:8]}"

    table_lines = _find_pipe_table(markdown)
    rows: list[ValidationRow] = []
    if len(table_lines) >= 3:
        # First line = header, second = separator, rest = body rows.
        for line in table_lines[2:]:
            if not line.strip():
                continue
            cells = _split_row(line)
            # The expected table has 5 columns; pad if short.
            if len(cells) < 5:
                cells = cells + [""] * (5 - len(cells))
            summary_cell, pred_date_cell, related_cell, relevance_cell, refs_cell = cells[:5]
            rows.append(
                ValidationRow(
                    prediction_summary=_strip_links(summary_cell).strip(),
                    prediction_date=_normalize_date(pred_date_cell),
                    related_items_text=_strip_links(related_cell).strip(),
                    observed_relevance=_parse_relevance(relevance_cell),
                    reference_links=_extract_links(refs_cell),
                    raw_row_markdown=line,
                )
            )

    return ValidationReport(path=path, validation_date=validation_date, rows=rows)


def parse_prediction_file(path: Path | str) -> ValidationReport:
    p = Path(path)
    text = p.read_bytes().decode("utf-8", errors="replace")
    return parse_prediction_markdown(text, source_path=p)
