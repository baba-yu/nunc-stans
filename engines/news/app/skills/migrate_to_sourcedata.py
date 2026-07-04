"""One-shot migrator: legacy markdown corpus -> ``app/sourcedata/<date>/*.json``.

Spec: ``design/sourcedata-layout.md §Migration phases — Phase 4``.

Reads the existing ``report/<L>/news-YYYYMMDD.md`` and
``future-prediction/<L>/future-prediction-YYYYMMDD.md`` files via the
legacy parsers (one last use), extracts every structured field, writes
the canonical sourcedata JSON files, and finally regenerates each
markdown file through the Phase 3 Jinja2 renderer so the on-disk corpus
becomes prose-only (no title / reasoning / mid-tier bullet keys, no ``**Summary:**``
markers, no ``Pred ID #N`` references).

Phase 4 scope (from the plan handoff):

  * Predictions whose title / reasoning / mid-tier fields were never authored (pre-
    2026-05-02 corpus) keep ``null`` reasoning fields. The renderer
    tolerates ``null`` and skips the "In plain language: …" paragraph.
    Backfill of those fields is a future ticket — Phase 4 does NOT
    spawn LLM sub-agents to fabricate them.
  * Needs are migrated from ``.jtbd-tmp/`` (gitignored) into
    ``app/sourcedata/<date>/needs.json`` (canonical). The
    ``.jtbd-tmp/`` files are NOT deleted — Phase 5 is the cleanup step.
  * The legacy ``news_parser.py`` and ``prediction_parser.py`` modules
    are still present for the migration; Phase 5 deletes them.

Public API:

    migrate_day(repo_root, date_iso, *, dry_run=False) -> dict

CLI:

    python -m app.skills.migrate_to_sourcedata --dates all
    python -m app.skills.migrate_to_sourcedata --date 2026-05-03
    python -m app.skills.migrate_to_sourcedata --dates all --dry-run
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

from app.src.parsers.news_parser import (
    PredictionSummary,
    parse_news_file,
    parse_news_markdown,
    _strip_links,
    _strip_scope_prefix,
    _strip_scope_prefix_anywhere,
    _extract_stream_c_reasoning,
    _extract_stream_j_title,
    _extract_stream_k_summary,
)
from app.src.parsers.prediction_parser import (
    parse_prediction_file,
    parse_prediction_markdown,
)
from app.skills import lint_markdown_clean
from app.skills.sourcedata_schemas import (
    BridgesFile,
    ChangeLogFile,
    HeadlinesFile,
    NeedsFile,
    NewsSectionFile,
    PredictionsFile,
)
from app.skills import render_future_prediction_md, render_news_md


LOCALES = ("ja", "es", "fil")
ALL_LOCALES = ("en",) + LOCALES


# ---------------------------------------------------------------------------
# Path helpers
# ---------------------------------------------------------------------------


def _news_path(repo_root: Path, locale: str, date_iso: str) -> Path:
    compact = date_iso.replace("-", "")
    return repo_root / "report" / locale / f"news-{compact}.md"


def _fp_path(repo_root: Path, locale: str, date_iso: str) -> Path:
    compact = date_iso.replace("-", "")
    return (
        repo_root / "future-prediction" / locale / f"future-prediction-{compact}.md"
    )


def _date_dir(repo_root: Path, date_iso: str) -> Path:
    return repo_root / "app" / "sourcedata" / date_iso


def _locale_date_dir(repo_root: Path, date_iso: str, locale: str) -> Path:
    return repo_root / "app" / "sourcedata" / "locales" / date_iso / locale


# ---------------------------------------------------------------------------
# Atomic write
# ---------------------------------------------------------------------------


def _write_json_atomic(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=path.name + ".", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        os.replace(tmp, path)
    except Exception:
        try:
            os.remove(tmp)
        except OSError:
            pass
        raise


# ---------------------------------------------------------------------------
# Stable prediction-id hashing (so all 4 locales agree without DB lookup)
# ---------------------------------------------------------------------------


def _stable_prediction_id(date_iso: str, body: str) -> str:
    """Mirror :func:`app.src.ingest._hash_id`'s ``||``-joined hash.

    The DB-side ingest hashes ``date||prediction_summary`` (= body)
    into ``prediction.<sha[:16]>``. We use the same recipe here so the
    JSON ``id`` is the same id the legacy ingest would have produced —
    which keeps round-trip equivalence on the ingest side and lets the
    locale fan-in match by hash alone.
    """
    h = hashlib.sha1((date_iso + "||" + body).encode("utf-8")).hexdigest()
    return f"prediction.{h[:16]}"


# ---------------------------------------------------------------------------
# Markdown -> structured extraction
# ---------------------------------------------------------------------------


_HEADLINES_BULLET_RE = re.compile(r"^-\s+(.+?)(?=\n-\s+|\n\n|\Z)", re.DOTALL | re.MULTILINE)
_LINK_RE = re.compile(r"\[([^\]]+)\]\((https?://[^\s)]+)\)")


def _extract_links_with_labels(text: str) -> list[dict]:
    out: list[dict] = []
    seen: set[str] = set()
    for m in _LINK_RE.finditer(text):
        url = m.group(2).strip()
        if url in seen:
            continue
        seen.add(url)
        out.append({"label": m.group(1).strip(), "url": url})
    return out


def _strip_trailing_links(text: str) -> str:
    """Strip trailing markdown link list (kept for citations) from a body."""
    # Remove trailing comma-separated bracket links from the tail of the body.
    # Walk from the end, removing `[label](url)` items + their separators.
    body = text.rstrip()
    # Repeatedly strip a trailing `[..](..)` (with optional preceding ", " or " ")
    while True:
        m = re.search(r"(?:[,\s]\s*)?\[[^\]]+\]\(https?://[^\s)]+\)\s*$", body)
        if not m:
            break
        body = body[: m.start()].rstrip()
    return body


def _split_h2_sections(markdown: str) -> dict[str, str]:
    """Split a markdown doc into ``{h2_title: body}`` keyed by H2 heading."""
    sections: dict[str, str] = {}
    h2_re = re.compile(r"^##\s+(.+?)\s*$", re.MULTILINE)
    matches = list(h2_re.finditer(markdown))
    for i, m in enumerate(matches):
        title = m.group(1).strip()
        body_start = m.end()
        body_end = matches[i + 1].start() if i + 1 < len(matches) else len(markdown)
        sections[title] = markdown[body_start:body_end].strip()
    return sections


def _parse_plain_headlines(body: str) -> list[str]:
    """``## Plain Headlines`` (or ``## Quick Reads``) — flat list of strings."""
    out: list[str] = []
    for line in body.splitlines():
        stripped = line.strip()
        if stripped.startswith("- "):
            text = stripped[2:].strip()
            if text:
                out.append(text)
    return out


def _parse_technical_headlines(body: str) -> list[dict]:
    """``## Headlines`` — bullet list of bold-leading items with citations.

    Legacy shape per item::

        - **Lead — body prose with **emphasis** as needed** [citation](url), [...]

    We split lead and body on the first ``—`` that appears inside the
    first paragraph (first non-blank line). Citations are the trailing
    ``[label](url)`` links not part of the lead/body prose.
    """
    items: list[dict] = []
    # Each item starts with `- ` at column 0 and ends at the next `- ` or
    # the next blank-line + something else, or end-of-section.
    item_re = re.compile(r"^-\s+(.+?)(?=\n-\s+|\Z)", re.DOTALL | re.MULTILINE)
    for m in item_re.finditer(body):
        raw = m.group(1).strip()
        # Citations: trailing markdown links (kept for the JSON).
        citations = _extract_links_with_labels(raw)
        # Strip trailing links from the prose to get clean body text.
        prose = _strip_trailing_links(raw)
        # Try to detect the bold-wrapped lead+body shape:
        #   **Lead — body prose** ...
        # Or a pair: **Lead** body prose
        bold_match = re.match(r"^\*\*(.+?)\*\*\s*(.*)$", prose, re.DOTALL)
        lead = ""
        body_text = prose
        if bold_match:
            inside_bold = bold_match.group(1).strip()
            after_bold = bold_match.group(2).strip()
            # Split inside the bold span on the first em-dash separator.
            if " — " in inside_bold:
                lead, _, body_inside = inside_bold.partition(" — ")
                lead = lead.strip()
                body_inside = body_inside.strip()
                if after_bold:
                    body_text = (body_inside + " — " + after_bold).strip(" —")
                else:
                    body_text = body_inside
            else:
                lead = inside_bold
                body_text = after_bold
        else:
            # No bold; first sentence becomes lead, rest becomes body.
            parts = prose.split(". ", 1)
            if len(parts) == 2:
                lead, body_text = parts[0].strip(), parts[1].strip()
            else:
                lead = prose[:80].strip()
                body_text = prose
        # Defensive: collapse whitespace on the body.
        body_text = re.sub(r"\s+", " ", body_text).strip()
        # Strip stray trailing punctuation residue from the trim.
        body_text = body_text.rstrip(" —")
        if not lead:
            lead = body_text[:80]
        items.append(
            {"lead": lead, "body": body_text, "citations": citations}
        )
    return items


def _parse_change_log(body: str) -> list[dict]:
    """``## Change Log`` — bullet list of free-form prose items."""
    items: list[dict] = []
    item_re = re.compile(r"^-\s+(.+?)(?=\n-\s+|\Z)", re.DOTALL | re.MULTILINE)
    for m in item_re.finditer(body):
        prose = m.group(1).strip()
        prose = re.sub(r"\s+", " ", prose)
        # Best-effort kind/headline split. The legacy convention is
        # `**New: <headline> — <body>**` or `**Updated: …**` etc; if we
        # can find the prefix we use it, else default to `continuing`.
        kind = "continuing"
        headline = prose[:80]
        kind_re = re.match(
            r"^(?:\*\*\s*)?(New|Updated|Continuing|Carry|Correction)\b\s*[:-]?\s*"
            r"(.+?)(?:\s+—\s+|\s*\*\*)",
            prose,
            re.IGNORECASE,
        )
        if kind_re:
            raw_kind = kind_re.group(1).lower()
            kind = {
                "new": "new",
                "updated": "updated",
                "continuing": "continuing",
                "carry": "continuing",
                "correction": "updated",
            }.get(raw_kind, "continuing")
            headline = kind_re.group(2).strip().rstrip("*").strip()
            if not headline:
                headline = prose[:80]
        items.append(
            {"kind": kind, "headline": headline, "diff_narrative": prose}
        )
    return items


def _parse_news_section(body: str) -> list[dict]:
    """``## News`` — H3 categories, optional H4 sub-categories, bullet items.

    The legacy corpus has both H3-only and H3+H4 days. We flatten H3+H4
    into a single ``category`` string ``"H3 > H4"`` so the JSON shape
    stays one-level (matches the schema in
    ``design/sourcedata-layout.md``).
    """
    sections: list[dict] = []
    # Split by H3 first; within each H3 split by H4 if present.
    h3_re = re.compile(r"^###\s+(.+?)\s*$", re.MULTILINE)
    h3_matches = list(h3_re.finditer(body))
    if not h3_matches:
        # Whole body is one anonymous category if there are bullets.
        bullets = _parse_news_bullets(body)
        if bullets:
            sections.append({"category": "Uncategorized", "bullets": bullets})
        return sections
    for i, h3m in enumerate(h3_matches):
        h3_title = h3m.group(1).strip()
        h3_body_start = h3m.end()
        h3_body_end = (
            h3_matches[i + 1].start() if i + 1 < len(h3_matches) else len(body)
        )
        h3_body = body[h3_body_start:h3_body_end]
        # Look for H4 children.
        h4_re = re.compile(r"^####\s+(.+?)\s*$", re.MULTILINE)
        h4_matches = list(h4_re.finditer(h3_body))
        if not h4_matches:
            bullets = _parse_news_bullets(h3_body)
            if bullets:
                sections.append({"category": h3_title, "bullets": bullets})
        else:
            # Any pre-H4 prose under the H3 stays under the bare H3 cat.
            pre_text = h3_body[: h4_matches[0].start()]
            pre_bullets = _parse_news_bullets(pre_text)
            if pre_bullets:
                sections.append({"category": h3_title, "bullets": pre_bullets})
            for j, h4m in enumerate(h4_matches):
                h4_title = h4m.group(1).strip()
                h4_body_start = h4m.end()
                h4_body_end = (
                    h4_matches[j + 1].start()
                    if j + 1 < len(h4_matches)
                    else len(h3_body)
                )
                h4_body = h3_body[h4_body_start:h4_body_end]
                bullets = _parse_news_bullets(h4_body)
                if bullets:
                    sections.append(
                        {
                            "category": f"{h3_title} > {h4_title}",
                            "bullets": bullets,
                        }
                    )
    return sections


def _parse_news_bullets(body: str) -> list[dict]:
    """Bullet list inside a news sub-section. Each item: prose + citations."""
    bullets: list[dict] = []
    item_re = re.compile(r"^-\s+(.+?)(?=\n-\s+|\n\n[^-\s]|\n\n\Z|\Z)", re.DOTALL | re.MULTILINE)
    for m in item_re.finditer(body):
        raw = m.group(1).strip()
        if not raw:
            continue
        citations = _extract_links_with_labels(raw)
        prose = _strip_trailing_links(raw)
        prose = re.sub(r"\s+", " ", prose).strip()
        if prose:
            bullets.append({"body": prose, "citations": citations})
    return bullets


# ---------------------------------------------------------------------------
# Per-locale prediction extraction (title/reasoning/plain_language/summary)
# ---------------------------------------------------------------------------


def _extract_prediction_locale_fields(
    pred: PredictionSummary,
) -> dict:
    """Return the locale-fillable subset of a parsed prediction.

    Mirrors what ``ingest._update_prediction_locale_cols`` accepts, so
    the JSON we write is interchangeable with the legacy markdown path
    when we re-ingest.
    """
    return {
        "title": pred.title,
        "summary": pred.summary,  # cleaned prose (links stripped)
        "summary_text": pred.summary_text,
        "reasoning_because": pred.reasoning_because,
        "reasoning_given": pred.reasoning_given,
        "reasoning_so_that": pred.reasoning_so_that,
        "reasoning_landing": pred.reasoning_landing,
        "plain_language": pred.plain_language,
    }


# ---------------------------------------------------------------------------
# JSON builders for a single (date, locale)
# ---------------------------------------------------------------------------


def _predictions_json_for_locale(
    repo_root: Path,
    date_iso: str,
    locale: str,
    canonical_ids: list[str] | None,
) -> dict | None:
    """Build a ``predictions.json``-shaped dict for one (date, locale).

    ``canonical_ids`` aligns the JSON ``id`` field across locales: the
    EN ingest produces a list of stable ids; subsequent locales reuse
    the same ids (matched positionally) so the locale fan-in can find
    the EN row.
    """
    path = _news_path(repo_root, locale, date_iso)
    if not path.is_file():
        return None
    report = parse_news_file(path)
    if not report.predictions:
        return None
    out_preds: list[dict] = []
    for idx, p in enumerate(report.predictions):
        # The body the renderer emits is the prediction's full prose
        # body (multi-paragraph, citation-bearing). Use the
        # link-stripped `summary` for the body so the rendered
        # markdown stays clean of inline link clutter; citations live
        # in the news_section.json bullet items, not in the prediction
        # body. (Matches the spec's "body = long-form prose".)
        body = p.summary or p.raw_markdown
        # Title fallback: legacy items predating title field have no
        # title — use the derived short_label.
        title = p.title or p.short_label
        # Reasoning fields are NULL on legacy items; tolerate by
        # filling empty strings (the schema requires str, not Optional).
        reasoning = {
            "because": p.reasoning_because or "",
            "given": p.reasoning_given or "",
            "so_that": p.reasoning_so_that or "",
            "landing": p.reasoning_landing or "",
            "plain_language": p.plain_language or "",
        }
        # Prefer the parsed `**Summary:**` mid-tier summary; fall back
        # to the body's first sentence so the JSON has SOMETHING in
        # `summary` (the schema requires it).
        summary = p.summary_text or _first_sentence(body)
        # Stable id derived from (date, body); lets the 4 locale files
        # agree without needing a DB hit.
        if canonical_ids and idx < len(canonical_ids):
            pid = canonical_ids[idx]
        else:
            pid = _stable_prediction_id(date_iso, body)
        out_preds.append(
            {
                "id": pid,
                "title": title,
                "body": body,
                "reasoning": reasoning,
                "summary": summary,
            }
        )
    return {"date": date_iso, "predictions": out_preds}


def _first_sentence(text: str) -> str:
    """Grab the first sentence of a prose body for a fallback ``summary``."""
    if not text:
        return ""
    # Split on '. ' but preserve the period.
    m = re.match(r"(.+?\.)(?:\s|\Z)", text.strip(), re.DOTALL)
    if m:
        return m.group(1).strip()
    return text.strip()[:280]


def _headlines_json(repo_root: Path, date_iso: str, locale: str) -> dict | None:
    path = _news_path(repo_root, locale, date_iso)
    if not path.is_file():
        return None
    text = path.read_bytes().decode("utf-8", errors="replace")
    sections = _split_h2_sections(text)
    plain_body = sections.get("Plain Headlines") or sections.get("Quick Reads") or ""
    tech_body = sections.get("Headlines") or ""
    plain = _parse_plain_headlines(plain_body)
    technical = _parse_technical_headlines(tech_body)
    return {"date": date_iso, "technical": technical, "plain": plain}


def _change_log_json(repo_root: Path, date_iso: str, locale: str) -> dict | None:
    path = _news_path(repo_root, locale, date_iso)
    if not path.is_file():
        return None
    text = path.read_bytes().decode("utf-8", errors="replace")
    sections = _split_h2_sections(text)
    body = sections.get("Change Log", "")
    items = _parse_change_log(body)
    # vs_date heuristic: previous calendar day. If the source file
    # mentions a different vs_date in its preamble, prefer that.
    import datetime as _dt

    vs_date = (_dt.date.fromisoformat(date_iso) - _dt.timedelta(days=1)).isoformat()
    vs_match = re.search(
        r"previous report\s*\(?(\d{4}-\d{2}-\d{2})\)?", body, re.IGNORECASE
    )
    if vs_match:
        vs_date = vs_match.group(1)
    return {"date": date_iso, "vs_date": vs_date, "items": items}


def _news_section_json(repo_root: Path, date_iso: str, locale: str) -> dict | None:
    path = _news_path(repo_root, locale, date_iso)
    if not path.is_file():
        return None
    text = path.read_bytes().decode("utf-8", errors="replace")
    sections = _split_h2_sections(text)
    body = sections.get("News", "")
    secs = _parse_news_section(body)
    return {"date": date_iso, "sections": secs}


def _bridges_json(
    repo_root: Path,
    date_iso: str,
    locale: str,
    canonical_pred_ids_by_short_label: dict[str, str],
) -> dict | None:
    path = _fp_path(repo_root, locale, date_iso)
    if not path.is_file():
        return None
    report = parse_prediction_file(path)
    if not report.rows:
        return None
    rows: list[dict] = []
    for row in report.rows:
        # Map prediction_summary text to a canonical id when we can.
        # No cross-day lookup here; we use a stable hash of
        # (prediction_date, prediction_summary) so the FP file can
        # round-trip independently of whether the source-day's
        # predictions.json was migrated.
        # Strip a leading scope prefix (`(Tech)` / `(Non-tech)` / etc.)
        # — legacy FP tables sometimes carry the prefix in the
        # prediction-summary cell, which would then leak into the
        # rendered "On the X prediction" sentence and trip the lint.
        short_label = _strip_scope_prefix_anywhere(row.prediction_summary).strip()
        if not short_label:
            short_label = row.prediction_summary
        pid = canonical_pred_ids_by_short_label.get(
            (row.prediction_date or "", short_label),
            _stable_prediction_id(row.prediction_date or "", short_label),
        )
        narrative = row.bridge_text or ""
        support_dim = row.support_dimension or "none"
        # Coherence + remaining_gap — best-effort extraction from the
        # legacy bridge paragraph if the parser has it; default 3 / "".
        coherence = 3
        remaining_gap = ""
        if row.bridge_text:
            coh_match = re.search(r"Coherence\s+(\d)/5", row.bridge_text)
            if coh_match:
                coherence = int(coh_match.group(1))
            gap_match = re.search(
                r"Remaining gap\s*:\s*(.+?)(?:\n|\Z)",
                row.bridge_text,
                re.DOTALL,
            )
            if gap_match:
                remaining_gap = gap_match.group(1).strip().rstrip(".")
            # Strip the parser anchors from the narrative so the JSON
            # holds clean prose. (`Coherence N/5` and `Remaining gap:
            # …` are forbidden tokens in the rendered markdown.)
            narrative = re.sub(
                r"\s*Coherence\s+\d/5\.?\s*", " ", narrative
            )
            narrative = re.sub(
                r"\s*Remaining gap\s*:.*?(?=\n\n|\Z)",
                "",
                narrative,
                flags=re.DOTALL,
            )
            narrative = re.sub(r"\s+", " ", narrative).strip()
        # Fallback narrative when no bridge paragraph was authored:
        # synthesize a one-sentence mention of the evidence so the
        # rendered markdown still says SOMETHING coherent for that
        # row's bridge paragraph.
        if not narrative:
            narrative = (
                f"Today's evidence: {row.related_items_text}"
                if row.related_items_text
                else "No bridge narrative was authored for this row."
            )
        # Clamp coherence to the schema's 1-5 implicit range.
        if not isinstance(coherence, int) or coherence < 1 or coherence > 5:
            coherence = 3
        rows.append(
            {
                "prediction_ref": {
                    "id": pid,
                    "short_label": short_label,
                    "prediction_date": row.prediction_date or "",
                },
                "today_relevance": row.observed_relevance
                if isinstance(row.observed_relevance, int)
                else 3,
                "evidence_summary": row.related_items_text or "",
                "reference_links": [
                    {"label": ref.title or ref.url, "url": ref.url}
                    for ref in row.reference_links
                ],
                "bridge": {
                    "support_dimension": support_dim
                    if support_dim
                    in ("because", "given", "so_that", "landing", "none")
                    else "none",
                    "narrative": narrative,
                    "coherence": coherence,
                    "remaining_gap": remaining_gap or "n/a",
                },
            }
        )
    return {"date": date_iso, "validation_rows": rows}


_TRUNCATED_TAIL_RE = re.compile(r"\[[^\]\n]*$|\([^)\n]*$")


def _scrub_truncated_tail(s: str) -> str:
    """Drop a trailing unclosed markdown link/paren from prose blocks.

    Several legacy locale files (especially ja) end mid-link in the
    `## Relation to My Own Predictions` section because the original
    LLM run was cut off. The structural-completeness check would
    refuse to ship a regenerated file with that trailing artifact
    intact. Trim it so the regenerated markdown stays clean.
    """
    s = s.rstrip()
    while True:
        m = _TRUNCATED_TAIL_RE.search(s)
        if not m:
            break
        s = s[: m.start()].rstrip().rstrip(",.;:")
    return s.strip()


def _summary_json(repo_root: Path, date_iso: str, locale: str) -> dict | None:
    """Optional ``summary.json`` carrying the FP report's three trailing prose blocks."""
    path = _fp_path(repo_root, locale, date_iso)
    if not path.is_file():
        return None
    text = path.read_bytes().decode("utf-8", errors="replace")
    sections = _split_h2_sections(text)
    out: dict = {}
    pl = (
        sections.get("Summary (Plain Language)")
        or sections.get("Summary (Layman)")
        or ""
    )
    if pl.strip():
        out["plain_language"] = _scrub_truncated_tail(
            re.sub(r"\s+", " ", pl).strip()
        )
    findings = sections.get("Summary of Findings", "")
    if findings.strip():
        out["findings"] = _scrub_truncated_tail(findings.strip())
    relation = sections.get("Relation to My Own Predictions", "")
    if relation.strip():
        out["relation_to_my_preds"] = _scrub_truncated_tail(relation.strip())
    # Drop empty entries the scrub may have produced.
    out = {k: v for k, v in out.items() if v}
    return out or None


# ---------------------------------------------------------------------------
# Needs migration from .jtbd-tmp/
# ---------------------------------------------------------------------------


_PRED_ID_FILENAME_RE = re.compile(
    r"today-needs-pred-(prediction\.[0-9a-f]{8,})(?:-en)?\.json$"
)
_DATE_KEYED_FILENAME_RE = re.compile(r"needs-pred-(\d{8})-\d+\.json$")


def _gather_needs_for_date(
    repo_root: Path,
    date_iso: str,
    canonical_pred_ids: list[str],
) -> dict | None:
    """Build the ``needs.json`` body for ``date_iso``.

    Sources (in priority order):

      * ``.jtbd-tmp/today-needs-pred-prediction.<pid>.json`` —
        per-prediction needs lists keyed by hashed id.
      * ``.jtbd-tmp/today-needs-pred-prediction.<pid>-en.json`` — an
        EN-stripped variant (multilingual fields removed). Only used
        as a fallback when the non-``-en`` variant is missing.
      * ``.jtbd-tmp/needs-pred-<YYYYMMDD>-<n>.json`` — date-keyed
        files with the prediction id implicit in the file's first
        record's actor/job context. We only use these for a date that
        has no per-prediction matches and we can map them to one of
        the day's canonical pred ids by index (positional fallback).

    The result is a dict keyed by stable prediction id. If no needs
    files match the date, returns None (meaning "no needs.json for
    this day").
    """
    tmp_dir = repo_root / ".jtbd-tmp"
    if not tmp_dir.is_dir():
        return None
    by_pred: dict[str, list[dict]] = {}
    canonical_set = set(canonical_pred_ids)
    # Per-pred files (preferred).
    for f in sorted(tmp_dir.glob("today-needs-pred-prediction.*.json")):
        m = _PRED_ID_FILENAME_RE.search(f.name)
        if not m:
            continue
        pid = m.group(1)
        is_en_stripped = f.name.endswith("-en.json")
        # Skip the -en variant if a non-en variant is present.
        if is_en_stripped:
            sibling = f.parent / f.name.replace("-en.json", ".json")
            if sibling.is_file():
                continue
        try:
            raw = json.loads(f.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        if not isinstance(raw, list):
            continue
        # Only attach to the day if pid is one of the day's canonical
        # ids — a single .jtbd-tmp/today-needs-pred-prediction.<pid>
        # file otherwise bleeds across dates.
        if canonical_set and pid not in canonical_set:
            continue
        by_pred.setdefault(pid, []).extend(raw)
    # Date-keyed files (positional fallback).
    if not by_pred:
        date_compact = date_iso.replace("-", "")
        for f in sorted(tmp_dir.glob(f"needs-pred-{date_compact}-*.json")):
            try:
                raw = json.loads(f.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                continue
            if not isinstance(raw, list):
                continue
            # Position from filename `needs-pred-<date>-<n>.json` is
            # 1-based; map into canonical_pred_ids if available.
            num_match = re.search(r"-(\d+)\.json$", f.name)
            if not num_match:
                continue
            idx = int(num_match.group(1)) - 1
            if 0 <= idx < len(canonical_pred_ids):
                pid = canonical_pred_ids[idx]
                by_pred.setdefault(pid, []).extend(raw)
    if not by_pred:
        return None
    # Deterministic ordering: sort by pid.
    out_by_pred: dict[str, list[dict]] = {
        pid: by_pred[pid] for pid in sorted(by_pred)
    }
    return {"date": date_iso, "by_prediction": out_by_pred}


def _split_locale_needs(
    needs_doc: dict, locale: str
) -> dict:
    """Build a locale-specific ``needs.json`` from the canonical (multilingual) one.

    Each Need record carries the EN ``actor``/``job``/etc. plus
    locale-suffixed siblings (`actor_ja`, `actor_es`, `actor_fil`, and
    the same for task fields). To produce a per-locale JSON file we
    rewrite each record so the EN keys hold the locale string and we
    drop the suffixed columns. Records with no locale string are
    skipped.
    """
    out_by_pred: dict[str, list[dict]] = {}
    suffix = "_" + locale
    for pid, recs in (needs_doc.get("by_prediction") or {}).items():
        loc_recs: list[dict] = []
        for rec in recs:
            actor = rec.get(f"actor{suffix}")
            if not actor:
                continue
            job = rec.get(f"job{suffix}") or rec.get("job", "")
            entry: dict = {"actor": actor, "job": job}
            outcome = rec.get(f"outcome{suffix}")
            if outcome:
                entry["outcome"] = outcome
            motivation = rec.get(f"motivation{suffix}")
            if motivation:
                entry["motivation"] = motivation
            task_in = rec.get("task") or {}
            task_out: dict = {}
            for cell in ("who", "what", "where", "when", "why", "how"):
                v = task_in.get(f"{cell}{suffix}")
                if v:
                    task_out[cell] = v
            if task_out:
                entry["task"] = task_out
            loc_recs.append(entry)
        if loc_recs:
            out_by_pred[pid] = loc_recs
    if not out_by_pred:
        return {}
    return {"date": needs_doc["date"], "by_prediction": out_by_pred}


def _strip_locale_columns(needs_doc: dict) -> dict:
    """Strip ``_ja`` / ``_es`` / ``_fil`` suffixed columns from the canonical needs.

    The canonical EN ``needs.json`` only carries the EN-language
    fields plus structural keys; the suffixed columns belong in the
    per-locale files under ``app/sourcedata/locales/<date>/<L>/``.
    """
    out_by_pred: dict[str, list[dict]] = {}
    for pid, recs in (needs_doc.get("by_prediction") or {}).items():
        clean_recs: list[dict] = []
        for rec in recs:
            actor = rec.get("actor", "")
            if not actor:
                continue
            entry: dict = {"actor": actor, "job": rec.get("job", "")}
            for k in ("outcome", "motivation"):
                if rec.get(k):
                    entry[k] = rec[k]
            task_in = rec.get("task") or {}
            task_out: dict = {}
            for cell in ("who", "what", "where", "when", "why", "how"):
                v = task_in.get(cell)
                if v:
                    task_out[cell] = v
            if task_out:
                entry["task"] = task_out
            clean_recs.append(entry)
        out_by_pred[pid] = clean_recs
    return {"date": needs_doc["date"], "by_prediction": out_by_pred}


# ---------------------------------------------------------------------------
# migrate_day
# ---------------------------------------------------------------------------


def migrate_day(
    repo_root: Path,
    date_iso: str,
    *,
    dry_run: bool = False,
) -> dict:
    """Migrate one date's full corpus to ``app/sourcedata/<date>/`` + locales.

    Returns a summary dict. Does NOT touch the DB and does NOT delete
    legacy `.jtbd-tmp/` files.
    """
    repo_root = Path(repo_root)
    summary: dict = {
        "date": date_iso,
        "predictions": 0,
        "headlines": False,
        "change_log": False,
        "news_section": False,
        "needs": 0,
        "bridges": 0,
        "summary_blocks": False,
        "regenerated": [],
        "skipped_reason": None,
    }

    en_news = _news_path(repo_root, "en", date_iso)
    if not en_news.is_file():
        summary["skipped_reason"] = "no EN news file"
        # Still attempt FP (some early days have FP without news).
    # ---- predictions.json (EN) ----
    canonical_ids: list[str] = []
    en_pred_doc = None
    if en_news.is_file():
        en_pred_doc = _predictions_json_for_locale(
            repo_root, date_iso, "en", canonical_ids=None
        )
        if en_pred_doc:
            canonical_ids = [p["id"] for p in en_pred_doc["predictions"]]
            summary["predictions"] = len(canonical_ids)

    # ---- per-day map of (pred_date, short_label) -> canonical_id for FP rows ----
    canonical_by_short_label: dict[tuple[str, str], str] = {}
    # Today's predictions (their own date).
    if en_pred_doc:
        for p in en_pred_doc["predictions"]:
            # short_label is title.
            canonical_by_short_label[(date_iso, p["title"])] = p["id"]
    # Other days the FP file might reference — best effort: also load the
    # 7 prior days' predictions.json equivalents (if migrated already)
    # OR derive the same stable id directly.
    # (No-op here: FP rows fall back to _stable_prediction_id when no
    # explicit map entry matches, which gives the same id any later
    # day's migration will produce.)

    # ---- headlines / change_log / news_section (EN) ----
    en_headlines = _headlines_json(repo_root, date_iso, "en")
    en_change_log = _change_log_json(repo_root, date_iso, "en")
    en_news_section = _news_section_json(repo_root, date_iso, "en")
    if en_headlines:
        summary["headlines"] = True
    if en_change_log:
        summary["change_log"] = True
    if en_news_section:
        summary["news_section"] = True

    # ---- bridges (EN) ----
    en_bridges = _bridges_json(
        repo_root, date_iso, "en", canonical_by_short_label
    )
    if en_bridges:
        summary["bridges"] = len(en_bridges["validation_rows"])

    # ---- summary.json (EN) ----
    en_summary = _summary_json(repo_root, date_iso, "en")
    if en_summary:
        summary["summary_blocks"] = True

    # ---- needs ----
    full_needs_doc = _gather_needs_for_date(repo_root, date_iso, canonical_ids)
    canonical_needs_doc = (
        _strip_locale_columns(full_needs_doc) if full_needs_doc else None
    )
    if canonical_needs_doc:
        summary["needs"] = sum(
            len(v) for v in canonical_needs_doc["by_prediction"].values()
        )

    if dry_run:
        return summary

    # ---- write canonical (EN) JSONs ----
    base = _date_dir(repo_root, date_iso)
    if en_pred_doc:
        # Validate before write.
        PredictionsFile.from_dict(en_pred_doc)
        _write_json_atomic(base / "predictions.json", en_pred_doc)
    if en_headlines:
        HeadlinesFile.from_dict(en_headlines)
        _write_json_atomic(base / "headlines.json", en_headlines)
    if en_change_log:
        ChangeLogFile.from_dict(en_change_log)
        _write_json_atomic(base / "change_log.json", en_change_log)
    if en_news_section:
        NewsSectionFile.from_dict(en_news_section)
        _write_json_atomic(base / "news_section.json", en_news_section)
    if en_bridges:
        BridgesFile.from_dict(en_bridges)
        _write_json_atomic(base / "bridges.json", en_bridges)
    if en_summary:
        _write_json_atomic(base / "summary.json", en_summary)
    if canonical_needs_doc:
        NeedsFile.from_dict(canonical_needs_doc)
        _write_json_atomic(base / "needs.json", canonical_needs_doc)

    # ---- write per-locale JSONs ----
    for loc in LOCALES:
        loc_base = _locale_date_dir(repo_root, date_iso, loc)
        # predictions
        if _news_path(repo_root, loc, date_iso).is_file():
            loc_pred = _predictions_json_for_locale(
                repo_root, date_iso, loc, canonical_ids
            )
            if loc_pred:
                PredictionsFile.from_dict(loc_pred)
                _write_json_atomic(loc_base / "predictions.json", loc_pred)
            loc_headlines = _headlines_json(repo_root, date_iso, loc)
            if loc_headlines:
                HeadlinesFile.from_dict(loc_headlines)
                _write_json_atomic(loc_base / "headlines.json", loc_headlines)
            loc_change_log = _change_log_json(repo_root, date_iso, loc)
            if loc_change_log:
                ChangeLogFile.from_dict(loc_change_log)
                _write_json_atomic(loc_base / "change_log.json", loc_change_log)
            loc_news_section = _news_section_json(repo_root, date_iso, loc)
            if loc_news_section:
                NewsSectionFile.from_dict(loc_news_section)
                _write_json_atomic(
                    loc_base / "news_section.json", loc_news_section
                )
        # bridges
        if _fp_path(repo_root, loc, date_iso).is_file():
            loc_bridges = _bridges_json(
                repo_root, date_iso, loc, canonical_by_short_label
            )
            if loc_bridges:
                BridgesFile.from_dict(loc_bridges)
                _write_json_atomic(loc_base / "bridges.json", loc_bridges)
            loc_summary = _summary_json(repo_root, date_iso, loc)
            if loc_summary:
                _write_json_atomic(loc_base / "summary.json", loc_summary)
        # needs locale fan-out
        if full_needs_doc:
            split = _split_locale_needs(full_needs_doc, loc)
            if split:
                NeedsFile.from_dict(split)
                _write_json_atomic(loc_base / "needs.json", split)

    # ---- regenerate markdown via Phase 3 renderer ----
    regenerated: list[str] = []
    for loc in ALL_LOCALES:
        # Re-render news only when an EN news file existed (the
        # renderer reads JSON sourcedata; if no JSON was written for
        # this locale + day we'd produce a near-empty file).
        if _news_path(repo_root, loc, date_iso).is_file() and en_pred_doc:
            try:
                out = render_news_md.render_and_write(
                    repo_root, date_iso, loc
                )
                regenerated.append(str(out))
            except Exception as e:
                raise RuntimeError(
                    f"news render failed for {date_iso}/{loc}: {e}"
                ) from e
        if _fp_path(repo_root, loc, date_iso).is_file() and en_bridges:
            try:
                out = render_future_prediction_md.render_and_write(
                    repo_root, date_iso, loc
                )
                regenerated.append(str(out))
            except Exception as e:
                raise RuntimeError(
                    f"FP render failed for {date_iso}/{loc}: {e}"
                ) from e

    summary["regenerated"] = regenerated

    # ---- lint every regenerated file ----
    if regenerated:
        rc = lint_markdown_clean.lint_paths([Path(p) for p in regenerated])
        if rc != 0:
            raise RuntimeError(
                f"lint_markdown_clean failed for one or more regenerated "
                f"files on {date_iso} (renderer bug)"
            )

    return summary


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def _scan_corpus_dates(repo_root: Path) -> list[str]:
    """Return every date that has at least one EN news or FP markdown."""
    dates: set[str] = set()
    for kind, root in (("news", repo_root / "report" / "en"),
                       ("fp", repo_root / "future-prediction" / "en")):
        if not root.is_dir():
            continue
        for f in root.iterdir():
            m = re.match(
                rf"(?:news|future-prediction)-(\d{{8}})\.md$", f.name
            )
            if m:
                d = m.group(1)
                dates.add(f"{d[0:4]}-{d[4:6]}-{d[6:8]}")
    return sorted(dates)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        description=(
            "Migrate the legacy markdown corpus to app/sourcedata/<date>/ "
            "JSON + regenerate every markdown file via the Phase 3 renderer."
        )
    )
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--date", help="ISO date YYYY-MM-DD")
    g.add_argument(
        "--dates",
        help='Set "all" to iterate every date with markdown in report/en/.',
    )
    p.add_argument("--repo-root", default=".", help="Repository root.")
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Report what would happen, no writes.",
    )
    args = p.parse_args(argv)

    repo_root = Path(args.repo_root).resolve()
    if args.date:
        dates = [args.date]
    else:
        if args.dates != "all":
            p.error("--dates supports only the literal value 'all'")
        dates = _scan_corpus_dates(repo_root)
    print(f"migrate_to_sourcedata: {len(dates)} date(s) to process")
    failures: list[tuple[str, str]] = []
    totals = {
        "predictions": 0, "headlines": 0, "change_log": 0,
        "news_section": 0, "bridges": 0, "needs": 0,
        "summary_blocks": 0, "regenerated": 0,
    }
    for d in dates:
        try:
            s = migrate_day(repo_root, d, dry_run=args.dry_run)
        except Exception as e:
            failures.append((d, str(e)))
            print(f"FAIL {d}: {e}", file=sys.stderr)
            continue
        totals["predictions"] += s["predictions"]
        totals["headlines"] += int(bool(s["headlines"]))
        totals["change_log"] += int(bool(s["change_log"]))
        totals["news_section"] += int(bool(s["news_section"]))
        totals["bridges"] += s["bridges"]
        totals["needs"] += s["needs"]
        totals["summary_blocks"] += int(bool(s["summary_blocks"]))
        totals["regenerated"] += len(s["regenerated"])
        print(
            f"OK {d}: preds={s['predictions']} headlines={s['headlines']} "
            f"change_log={s['change_log']} news_section={s['news_section']} "
            f"bridges={s['bridges']} needs={s['needs']} "
            f"regenerated={len(s['regenerated'])}"
        )
    print(
        f"\nTOTAL: preds={totals['predictions']} "
        f"headlines={totals['headlines']} "
        f"change_log={totals['change_log']} "
        f"news_section={totals['news_section']} "
        f"bridges={totals['bridges']} "
        f"needs={totals['needs']} "
        f"summary_blocks={totals['summary_blocks']} "
        f"regenerated={totals['regenerated']}"
    )
    if failures:
        print(f"\n{len(failures)} failure(s):", file=sys.stderr)
        for d, msg in failures:
            print(f"  - {d}: {msg}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
