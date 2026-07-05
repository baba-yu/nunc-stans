"""Inject hover-glossary `<abbr>` markers into rendered body text (glossary stream).

Reads the SQLite `glossary_terms` table and rewrites the input markdown
so that every `status='active'` term becomes `<abbr title="…">term</abbr>`
on first occurrence per section. Candidate rows are NOT injected — only
human- or LLM-vetted active rows are exposed to readers.

The dashboard already renders inline HTML inside the panel body
(see `renderMarkdown` in `docs/assets/app.js`), so injecting `<abbr>`
elements at export-time gives the hover behavior on every locale
without any front-end changes.

Designed to be called from `app/src/export.py` when populating
`detail.description` / `detail.prediction_summary` for prediction
nodes — the writer's plain markdown stays untouched in `report/`
on disk.
"""

from __future__ import annotations

import json
import re
import sqlite3
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class GlossaryEntry:
    term: str
    aliases: tuple[str, ...]
    quick_def: str
    why_it_matters: str


def load_active_glossary(db_path: Path) -> list[GlossaryEntry]:
    """Pull all `status='active'` rows from glossary_terms."""
    if not db_path.is_file():
        return []
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        cur = conn.execute(
            """
            SELECT term, aliases_json, quick_def, why_it_matters
              FROM glossary_terms
             WHERE status = 'active'
               AND quick_def IS NOT NULL
               AND quick_def <> ''
            """
        )
        out: list[GlossaryEntry] = []
        for row in cur.fetchall():
            aliases_raw = row["aliases_json"] or "[]"
            try:
                aliases = tuple(json.loads(aliases_raw))
            except json.JSONDecodeError:
                aliases = ()
            out.append(
                GlossaryEntry(
                    term=row["term"],
                    aliases=aliases,
                    quick_def=row["quick_def"] or "",
                    why_it_matters=row["why_it_matters"] or "",
                )
            )
        return out
    finally:
        conn.close()


def _build_pattern(entries: list[GlossaryEntry]) -> tuple[re.Pattern[str], dict[str, GlossaryEntry]]:
    """Build a single regex matching every term + alias, longest first.

    Longest-first ordering makes "MITRE-CNA" match before "CNA" in the
    same input, so the more specific entry wins.
    """
    by_token: dict[str, GlossaryEntry] = {}
    for e in entries:
        for token in (e.term, *e.aliases):
            if not token:
                continue
            key = token.casefold()
            # First entry registered for a token wins (entries are
            # ordered by primary term, so aliases never overshadow primaries).
            by_token.setdefault(key, e)
    if not by_token:
        return re.compile(r"$.^"), by_token  # never matches
    sorted_tokens = sorted(by_token.keys(), key=len, reverse=True)
    pattern_src = r"(?<![A-Za-z0-9_])(" + "|".join(re.escape(t) for t in sorted_tokens) + r")(?![A-Za-z0-9_])"
    return re.compile(pattern_src, re.IGNORECASE), by_token


def annotate(text: str, entries: list[GlossaryEntry]) -> str:
    """Wrap the first occurrence of each active term in `<abbr>`."""
    if not entries or not text:
        return text
    pattern, by_token = _build_pattern(entries)
    seen: set[str] = set()

    def _replace(m: re.Match[str]) -> str:
        original = m.group(1)
        key = original.casefold()
        if key in seen:
            return original
        entry = by_token.get(key)
        if not entry:
            return original
        seen.add(key)
        title = (entry.quick_def or "").replace('"', "&quot;").strip()
        if entry.why_it_matters:
            why = entry.why_it_matters.replace('"', "&quot;").strip()
            title = f"{title} — {why}"
        return f'<abbr title="{title}">{original}</abbr>'

    return pattern.sub(_replace, text)


def annotate_with_db(text: str, db_path: Path) -> str:
    """Convenience wrapper: load entries + annotate in one call."""
    return annotate(text, load_active_glossary(db_path))
