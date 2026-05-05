"""Parse ``report/news-YYYYMMDD.md`` files.

Locale convention (feature/locale branch):
    Section headers in news files stay literally English in every
    locale: ``## Future``, ``## Headlines``, ``## News``,
    ``## Change Log``. The body of each section is translated; only
    the H2 headers are not. If a translator localizes a header, the
    parser will silently miss that section — by design, so we can
    detect drift via missing predictions in the analytics output.

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

# Scope-prefix tokens the writer was historically asked to put on each
# prediction (`(Tech)` / `(Non-tech)` / `(Business)` / `(Mix)`) and
# their localized translations seen in real news output:
#   JA:  (技術) (非技術) (ビジネス) (ミックス) (テクノロジー)
#   ES:  (Tecnología) (Tec) (Negocio) (Mix) (Técnico)
#   FIL: (Tech) (Non-Tech) (Teknikal) (Negosyo) — Filipino tends to
#        keep English tokens; we still strip the native variants.
# The orchestrator's writer-rules forbid emitting these in any locale,
# but legacy news files already on disk have them — strip at ingest
# time so DB rows ship clean and the dashboard never sees the prefix.
_PREFIX_TOKENS = (
    # English
    "tech", "non-tech", "non tech", "nontech",
    "non-technical", "non technical", "nontechnical",
    "technical", "technology",
    "business", "biz", "mix",
    # Japanese
    "技術", "非技術", "非-技術", "非 技術",
    "テクノロジー", "非テクノロジー",
    "ビジネス", "非ビジネス", "ビジ", "ミックス",
    # Spanish
    "tecnología", "tecnologia",
    "no-tecnología", "no-tecnologia",
    "no tecnología", "no tecnologia",
    "tec", "no-tec", "no tec",
    "técnico", "tecnico",
    "no-técnico", "no-tecnico", "no técnico", "no tecnico",
    "negocio", "no-negocio",
    # Filipino
    "teknikal", "hindi-teknikal", "hindi teknikal",
    "negosyo", "halo", "halong",
)
# Sort longest-first so e.g. "non-technical" beats "tech" when both
# could match the same prefix.
_PREFIX_ALT = "|".join(
    re.escape(t) for t in sorted(_PREFIX_TOKENS, key=len, reverse=True)
)
# Full-paren shape: `(Tech)`, `(技術)`, `(Tecnología)`, etc.
_PREFIX_FULL_RE = re.compile(
    rf"^\s*\(\s*(?:{_PREFIX_ALT})\s*\)\s*",
    re.IGNORECASE,
)
# Half-paren shape: `Tech)` / `技術)` — the legacy strip-set in
# _derive_short_label removed the leading `(` but left the `)`.
_PREFIX_HALF_RE = re.compile(
    rf"^\s*(?:{_PREFIX_ALT})\s*\)\s*",
    re.IGNORECASE,
)


def _strip_scope_prefix(s: str) -> str:
    """Remove a leading scope-prefix in any supported locale, looping
    so accidentally double-tagged inputs like ``(Mix) (Tech) …`` get
    fully cleared. Idempotent."""
    if not s:
        return s
    prev = None
    while prev != s:
        prev = s
        s = _PREFIX_FULL_RE.sub("", s)
        s = _PREFIX_HALF_RE.sub("", s)
    return s


# Bold-wrapped variants seen in real news files:
#   `**(Tech) body…**`   — prefix INSIDE the bold span, body bold too
#   `**(Tech)** body…`   — standalone bold with just the prefix
#   `**(技術) 2026年下半期までに、…**` — same pattern in JA
# We strip these without breaking the surrounding markdown — body
# downstream then runs through _extract_stream_j_title /
# _extract_stream_c_reasoning / _derive_short_label cleanly.
_BOLD_STANDALONE_PREFIX_RE = re.compile(
    rf"^\s*\*\*\s*\(?\s*(?:{_PREFIX_ALT})\s*\)\s*\*\*\s*",
    re.IGNORECASE,
)
_BOLD_OPEN_PREFIX_RE = re.compile(
    rf"^\s*\*\*\s*\(?\s*(?:{_PREFIX_ALT})\s*\)\s+",
    re.IGNORECASE,
)


def _strip_scope_prefix_anywhere(s: str) -> str:
    """Strip a leading scope prefix even when wrapped in markdown bold.

    Handles three shapes a writer might produce in any locale:
      - `(Tech) body`    → ` body`
      - `**(Tech) body**`→ `**body**`  (bold span stays open)
      - `**(Tech)** body`→ ` body`     (drops the empty bold span)

    Loops so a double-tagged item like `**(Mix)** **(Tech) body**`
    gets fully cleared.
    """
    if not s:
        return s
    prev = None
    while prev != s:
        prev = s
        # Standalone bold first — `**(Tech)**` with nothing else inside.
        s = _BOLD_STANDALONE_PREFIX_RE.sub("", s)
        # Bold-open prefix — `**(Tech) body…**`. Strip the prefix +
        # whitespace, leave the opening `**` so the rest of the body
        # remains a bold span.
        s = _BOLD_OPEN_PREFIX_RE.sub("**", s)
        # Plain (no bold).
        s = _strip_scope_prefix(s)
    return s.lstrip()


@dataclass
class PredictionSummary:
    """Numbered item from the ``## Future`` section."""

    index: int
    summary: str  # plain text w/o markdown link clutter
    short_label: str
    raw_markdown: str
    reference_links: list[str] = field(default_factory=list)
    # Stream J: dedicated short title (≤ 80 chars). NULL when the
    # writer hasn't emitted one (legacy items predating 2026-05-02).
    title: str | None = None
    # Stream C: structured reasoning trace. NULL on legacy items;
    # populated when the writer emits the 5-field block right under
    # the Stream J title line.
    reasoning_because: str | None = None
    reasoning_given: str | None = None
    reasoning_so_that: str | None = None
    reasoning_landing: str | None = None
    eli14: str | None = None
    # Stream K (Phase B): mid-tier summary the writer emits as a
    # `**Summary:**` marker block between the reasoning bullets and
    # the long-form body. NULL when the writer didn't write one
    # (legacy items + un-backfilled predictions). The dashboard
    # right pane shows this immediately under the title; the
    # multi-paragraph long body is collapsed below.
    summary_text: str | None = None


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


def _extract_stream_j_title(body: str) -> tuple[str | None, str]:
    """Detect a Stream J one-line title at the start of a prediction body.

    Stream J writer rule (active 2026-05-02): each `## Future` item starts
    with a one-line title (≤ 80 chars, no markdown, no scope prefix),
    followed by a blank line, followed by the existing prose body. We
    detect the pattern by:

    1. The first non-blank line has no `**` / `*` / backtick markdown.
    2. The first non-blank line is ≤ 80 chars after trimming.
    3. The first non-blank line is followed by ≥ 1 fully blank line.
    4. The first non-blank line does not start with a leading scope
       prefix `(Tech)` / `(Business)` / `(Mix)` — those are the legacy
       bold-titles the existing `bold_hint` path already handles.

    On a match, returns (title, body_remainder). On no match (legacy
    format), returns (None, body) unchanged.
    """
    raw_lines = body.splitlines()
    # Trim leading empty lines so the regex captures from real content.
    i = 0
    while i < len(raw_lines) and not raw_lines[i].strip():
        i += 1
    if i >= len(raw_lines):
        return None, body
    head = raw_lines[i].strip()
    # Must NOT contain any markdown emphasis or backtick.
    if "**" in head or "`" in head or re.search(r"(?<!\\)\*", head):
        return None, body
    # Must be reasonably short. The EN writer rule caps at 80 chars,
    # but locale translations (especially ES + FIL) can run 20-30%
    # longer than their EN source. We extend the parser cap to 200
    # so locale fan-out titles still parse — the format itself
    # (title-then-blank-line-then-Stream-C-bullets) is the real
    # discriminator from prose, not the raw character count.
    if len(head) > 200:
        return None, body
    # If the writer leaked a scope prefix (in any locale) into the title
    # line, strip it rather than reject the whole title — fail-safe so
    # legacy items still get a usable title instead of falling through
    # to the markdown-heavy bold_hint path.
    cleaned = _strip_scope_prefix(head).strip()
    if cleaned and cleaned != head:
        head = cleaned
    # Next non-blank line must exist AND there must be a blank gap between.
    if i + 1 >= len(raw_lines):
        return None, body
    if raw_lines[i + 1].strip():
        # No blank-line separator — the head is part of the prose, not a title.
        return None, body
    # Strip the title line + the blank gap + any further leading blanks.
    j = i + 2
    while j < len(raw_lines) and not raw_lines[j].strip():
        j += 1
    return head, "\n".join(raw_lines[j:]).strip()


_STREAM_C_FIELDS = ("because", "given", "so_that", "landing", "eli14")


def _extract_stream_k_summary(body: str) -> tuple[str | None, str]:
    """Detect a Stream K `**Summary:**` marker block.

    Stream K writer rule (active 2026-05-02 forward): after the
    Stream C reasoning bullets and the blank-line gap, the writer
    optionally emits a single-paragraph mid-tier summary marked with
    a leading bold ``**Summary:**`` token. The block ends at the
    next blank line; everything after the blank is the long-form
    body.

    Format:
      **Summary:** A 2-3 sentence paragraph in plain technical
      prose, ≤ 300 chars. This becomes predictions.summary; the
      dashboard right pane renders it directly under the title and
      collapses the long-form body in a <details> below.

    Returns (summary_text, remainder). On no match, (None, body).
    """
    lines = body.splitlines()
    i = 0
    while i < len(lines) and not lines[i].strip():
        i += 1
    if i >= len(lines):
        return None, body
    marker = re.match(r"^\s*\*\*Summary\s*:\s*\*\*\s*(.*)$", lines[i], re.IGNORECASE)
    if not marker:
        return None, body
    parts = [marker.group(1).strip()] if marker.group(1).strip() else []
    j = i + 1
    while j < len(lines) and lines[j].strip():
        parts.append(lines[j].strip())
        j += 1
    summary = " ".join(p for p in parts if p).strip()
    if not summary:
        return None, body
    # Drop a trailing `**` if the writer wrapped the whole block in
    # bold instead of just the marker.
    summary = re.sub(r"\*+$", "", summary).strip()
    while j < len(lines) and not lines[j].strip():
        j += 1
    return summary, "\n".join(lines[j:]).strip()


def _extract_stream_c_reasoning(body: str) -> tuple[dict[str, str], str]:
    """Detect a Stream C 5-field reasoning block at the start of `body`.

    Stream C writer rule (active 2026-05-02): immediately after the
    Stream J title (and the blank-line gap), the writer emits a
    bullet list of exactly 5 fields::

        - because: <observed precondition>
        - given: <structural force>
        - so_that: <consequence>
        - landing: <when + actor placement>
        - eli14: <one-sentence plain language>

    The block ends with a blank line; prose body resumes after it.

    On detection, returns ({field: value}, remainder). On no match,
    returns ({}, body) unchanged so the legacy parser path wins.
    """
    # Walk forward through leading blanks, then capture lines that
    # match the `- <field>:` shape until we hit a blank or non-bullet line.
    lines = body.splitlines()
    i = 0
    while i < len(lines) and not lines[i].strip():
        i += 1
    captured: dict[str, str] = {}
    bullet_re = re.compile(r"^\s*-\s+(because|given|so_that|landing|eli14)\s*:\s*(.*)$")
    while i < len(lines):
        m = bullet_re.match(lines[i])
        if not m:
            break
        field = m.group(1)
        value = m.group(2).strip()
        # Continuation lines: the writer may break a long `eli14:` across
        # lines without a leading bullet — we accept the first non-bullet
        # non-blank line as a continuation, but only one.
        if i + 1 < len(lines) and lines[i + 1].strip() and not bullet_re.match(lines[i + 1]):
            cont = lines[i + 1].strip()
            value = (value + " " + cont).strip() if value else cont
            i += 1
        captured[field] = value
        i += 1
    # We require *all five* fields to commit the parse — partial blocks
    # are too ambiguous (the writer might be drafting). Without all five
    # we treat the body as legacy prose.
    if set(captured.keys()) != set(_STREAM_C_FIELDS):
        return {}, body
    # Strip the matched lines + any trailing blanks so the prose body
    # starts cleanly.
    while i < len(lines) and not lines[i].strip():
        i += 1
    return captured, "\n".join(lines[i:]).strip()


def _derive_short_label(summary: str, bold_hint: str | None, fallback_idx: int) -> str:
    """Pick a concise label for the prediction."""
    base = bold_hint or summary
    # Squash whitespace and strip surrounding punctuation.
    base = re.sub(r"\s+", " ", base).strip(" 　—-:：「」『』\"'()[]{}")
    # Multi-locale scope-prefix strip BEFORE clause splitting — if the
    # source had `(技術)` or `(Tecnología)` etc. as a leading wart, get
    # rid of it now so the resulting short_label doesn't carry it into
    # the DB. The historical strip-set above already removed an
    # opening `(` from the bare edge; _PREFIX_HALF_RE catches that
    # half-paren shape too.
    base = _strip_scope_prefix(base).strip()
    # Prefer first clause before a punctuation break. ". " (period +
    # space) is the English sentence boundary; checked after the
    # CJK-and-em-dash separators so multilingual prose hitting any
    # of them earlier still wins.
    for sep in ("—", "――", " - ", "。", "、", "：", ". "):
        if sep in base:
            base = base.split(sep, 1)[0].strip()
            break
    # In case the clause-split exposed a freshly-stripped prefix
    # (e.g. `Tech) — body` → `Tech)` after the split), run the prefix
    # strip one more time on the trimmed first clause.
    base = _strip_scope_prefix(base).strip()
    if not base:
        base = f"Prediction {fallback_idx}"
    # No length cap here: the frontend handles ellipsis on the cell /
    # canvas label via CSS. Storing the truncated form would lose the
    # rest of the clause permanently.
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
            raw_body = item_match.group(2).rstrip()
            # Strip a leading scope prefix in any locale BEFORE any other
            # extraction. Handles plain `(Tech) body…`, half-paren
            # `Tech) body…`, bold-wrapped `**(Tech) body…**`, and the
            # standalone-bold `**(Tech)** body…`. Without this the
            # short_label, the summary, and the full prediction text
            # all carry the prefix forward into the DB and the
            # dashboard.
            raw_body = _strip_scope_prefix_anywhere(raw_body)
            # Stream J: a one-line title at the start of the body, separated
            # by a blank line from the prose. None when the item is in the
            # legacy `**bold title** —` shape.
            stream_j_title, body_after_title = _extract_stream_j_title(raw_body)
            # Stream C: 5-field reasoning bullet list right after the title.
            # Only attempted when Stream J title was present (the two
            # streams ship together; partial Stream C without title is
            # not a supported writer state).
            reasoning: dict[str, str] = {}
            stream_k_summary: str | None = None
            if stream_j_title is not None:
                reasoning, body_after_reasoning = _extract_stream_c_reasoning(body_after_title)
                body = body_after_reasoning if reasoning else body_after_title
                # Stream K: optional `**Summary:**` mid-tier summary
                # block right after the reasoning bullets. Independent
                # of Stream C — Stream J + summary alone is a valid
                # state (writer wrote a summary but skipped the 5-field
                # reasoning). The body remainder becomes the long-form.
                stream_k_summary, body_after_summary = _extract_stream_k_summary(body)
                if stream_k_summary is not None:
                    body = body_after_summary
            else:
                body = raw_body
                # Even without Stream J/C, the writer might have placed
                # a `**Summary:**` block as the very first thing in a
                # legacy item — pick it up if so.
                stream_k_summary, body_after_summary = _extract_stream_k_summary(body)
                if stream_k_summary is not None:
                    body = body_after_summary
            # Look for **bold title** up front for short_label (legacy path).
            bold_hint = None
            bold = BOLD_RE.search(body)
            if bold:
                bold_hint = bold.group(1).strip()
            summary = _strip_links(body).strip()
            # Collapse runs of whitespace.
            summary = re.sub(r"\s+", " ", summary)
            # Stream J: when a clean title was extracted, prefer it as the
            # short_label hint over the (often markdown-heavy) bold_hint.
            short_label = _derive_short_label(
                summary,
                stream_j_title or bold_hint,
                idx,
            )
            predictions.append(
                PredictionSummary(
                    index=idx,
                    summary=summary,
                    short_label=short_label,
                    raw_markdown=raw_body,
                    reference_links=_extract_links(raw_body),
                    title=stream_j_title,
                    reasoning_because=reasoning.get("because"),
                    reasoning_given=reasoning.get("given"),
                    reasoning_so_that=reasoning.get("so_that"),
                    reasoning_landing=reasoning.get("landing"),
                    eli14=reasoning.get("eli14"),
                    summary_text=stream_k_summary,
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
