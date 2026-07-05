"""DEPRECATED in production flow (sourcedata-first ingest now canonical via cli update). Retained for legacy markdown-fallback recovery and tests.

Parse every markdown report under ``report/`` and
``future-prediction/`` and upsert rows into the analytics DB.

The ingest layer is intentionally simple: it calls the parsers, classifies
each prediction/validation row into a theme via keyword matching against
the seeded taxonomy, and inserts the corresponding DB rows. Predictions
that do not match any seeded theme are recorded as ``theme_candidates``.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import sqlite3
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path

from .db import connect, repo_root
from .parsers.news_parser import NewsReport, PredictionSummary, parse_news_file
from .parsers.prediction_parser import (
    EvidenceItem,
    ValidationReport,
    ValidationRow,
    parse_prediction_file,
)


# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------


LOCALES = ('en', 'ja', 'es', 'fil')


def report_dir() -> Path:
    return repo_root() / "report"


def future_prediction_dir() -> Path:
    return repo_root() / "future-prediction"


def _locale_of_path(path: Path) -> str:
    """Return the locale code for a report path.

    Locale-aware corpus layout (feature/locale branch):
        report/<locale>/news-YYYYMMDD.md
        future-prediction/<locale>/future-prediction-YYYYMMDD.md

    The parent directory name is the locale. If the file lives at the
    flat (legacy) location, default to 'en'.
    """
    parent = path.parent.name.lower()
    if parent in LOCALES:
        return parent
    return 'en'


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _sha(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()


def _hash_id(prefix: str, *parts: str) -> str:
    h = hashlib.sha1("||".join(parts).encode("utf-8")).hexdigest()[:16]
    return f"{prefix}.{h}"


def _canonicalize_url(url: str) -> str:
    # Lower-case scheme+host, drop trailing slash and ``#fragments``.
    u = url.strip()
    u = u.split("#", 1)[0]
    u = u.rstrip("/")
    return u


# ---------------------------------------------------------------------------
# Theme matching
# ---------------------------------------------------------------------------


@dataclass
class ThemeRow:
    theme_id: str
    scope_id: str
    category_id: str
    canonical_label: str
    short_label: str | None
    description: str | None


_TOKEN_RE = re.compile(r"[A-Za-z0-9]+|[぀-ヿ一-鿿]+")


def _tokens(text: str) -> set[str]:
    if not text:
        return set()
    return {t.lower() for t in _TOKEN_RE.findall(text) if len(t) >= 2}


def _theme_keywords(theme: ThemeRow) -> set[str]:
    # Combine canonical/short labels + description tokens.
    return (
        _tokens(theme.canonical_label)
        | _tokens(theme.short_label or "")
        | _tokens(theme.description or "")
    )


def _score_theme_match(text_tokens: set[str], theme_tokens: set[str]) -> int:
    return len(text_tokens & theme_tokens)


def _idf_score(
    text_tokens: set[str], theme_tokens: set[str], df: dict[str, int]
) -> float:
    """Inverse-frequency-weighted overlap.

    Tokens that appear across many theme keyword sets (e.g. ``agent``,
    ``ai``) contribute less than rare ones so a prediction that mentions
    ``agent`` eight times can't just pile into whichever theme happens to
    have the longest description.
    """
    return sum(1.0 / df[tok] for tok in (text_tokens & theme_tokens) if df.get(tok, 0) > 0)


def _load_themes(conn: sqlite3.Connection) -> list[ThemeRow]:
    cur = conn.execute(
        """
        SELECT theme_id, scope_id, category_id, canonical_label, short_label, description
        FROM themes
        WHERE status IN ('active', 'candidate')
        """
    )
    return [ThemeRow(**dict(row)) for row in cur.fetchall()]


# A prediction is assigned to a non-winning scope only when that scope's
# top theme score is at least this fraction of the winning scope's. With
# IDF-only scoring every prediction has *some* token overlap in both
# scopes (e.g. "ai", "open"), so a bare score>0 filter assigned every
# prediction to both scopes — see design/FIXME.md "mix / tech / business
# graphs export the same prediction set". Empirically the median ratio
# is ~0.4, so 0.5 splits clear-single-scope (~33/49) from genuine
# cross-scope (~16/49) on the current corpus.
SECONDARY_SCOPE_MIN_RATIO = 0.5


def _pick_theme_per_scope(
    text: str, themes: list[ThemeRow]
) -> dict[str, ThemeRow]:
    """Return best theme per scope, with a margin filter.

    The winning scope is always kept. A non-winning scope is kept only
    when its top theme score is at least ``SECONDARY_SCOPE_MIN_RATIO``
    of the winning score — a prediction is single-scope by default and
    cross-scope only when both scopes match strongly.
    """
    tokens = _tokens(text)
    # Precompute theme keyword sets + document frequency across themes.
    theme_tokens = [_theme_keywords(t) for t in themes]
    df: dict[str, int] = {}
    for ts in theme_tokens:
        for tok in ts:
            df[tok] = df.get(tok, 0) + 1
    best_per_scope: dict[str, tuple[float, ThemeRow]] = {}
    for theme, t_tokens in zip(themes, theme_tokens):
        score = _idf_score(tokens, t_tokens, df)
        if score <= 0:
            continue
        cur = best_per_scope.get(theme.scope_id)
        if cur is None or score > cur[0]:
            best_per_scope[theme.scope_id] = (score, theme)
    if not best_per_scope:
        return {}
    primary_score = max(s for s, _ in best_per_scope.values())
    threshold = primary_score * SECONDARY_SCOPE_MIN_RATIO
    return {
        scope: t
        for scope, (s, t) in best_per_scope.items()
        if s >= threshold
    }


# ---------------------------------------------------------------------------
# DB upserts
# ---------------------------------------------------------------------------


def _upsert_source_file(
    conn: sqlite3.Connection,
    *,
    path: Path,
    file_type: str,
    report_date: str,
    content: str,
    locale: str = 'en',
) -> str:
    rel = str(path.relative_to(repo_root())).replace("\\", "/")
    source_file_id = _hash_id("source", rel)
    conn.execute(
        """
        INSERT INTO source_files (source_file_id, path, file_type, report_date, content_sha, parsed_at, locale)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(path) DO UPDATE SET
          report_date=excluded.report_date,
          content_sha=excluded.content_sha,
          parsed_at=excluded.parsed_at,
          locale=excluded.locale
        """,
        (source_file_id, rel, file_type, report_date, _sha(content), _now_iso(), locale),
    )
    # The hash ID might diverge from the pre-existing row if the path was
    # stored first with a different ID. Resolve back to the stored one.
    cur = conn.execute(
        "SELECT source_file_id FROM source_files WHERE path = ?", (rel,)
    )
    row = cur.fetchone()
    return row["source_file_id"] if row else source_file_id


def _upsert_evidence(
    conn: sqlite3.Connection,
    *,
    url: str,
    title: str | None,
    first_seen: str,
    source_file_id: str | None,
) -> str:
    canonical = _canonicalize_url(url)
    # The unique index on canonical_url is partial (WHERE canonical_url IS
    # NOT NULL), which SQLite does not accept as a conflict target; do the
    # upsert manually.
    cur = conn.execute(
        "SELECT evidence_id FROM evidence_items WHERE canonical_url = ?",
        (canonical,),
    )
    existing = cur.fetchone()
    if existing is not None:
        conn.execute(
            """
            UPDATE evidence_items SET
              last_seen_date = ?,
              title = COALESCE(?, title),
              updated_at = ?
            WHERE evidence_id = ?
            """,
            (first_seen, title, _now_iso(), existing["evidence_id"]),
        )
        return existing["evidence_id"]
    evidence_id = _hash_id("evidence", canonical)
    conn.execute(
        """
        INSERT INTO evidence_items (
          evidence_id, url, canonical_url, title,
          source_type, first_seen_date, last_seen_date,
          memory_status, source_file_id
        ) VALUES (?, ?, ?, ?, 'news', ?, ?, 'active_memory', ?)
        """,
        (evidence_id, url, canonical, title, first_seen, first_seen, source_file_id),
    )
    return evidence_id


def _upsert_prediction(
    conn: sqlite3.Connection,
    *,
    prediction_summary: str,
    short_label: str,
    prediction_date: str,
    source_file_id: str,
    source_row_index: int,
    raw_text: str,
    title: str | None = None,
    reasoning_because: str | None = None,
    reasoning_given: str | None = None,
    reasoning_so_that: str | None = None,
    reasoning_landing: str | None = None,
    plain_language: str | None = None,
    summary_text: str | None = None,
) -> str:
    prediction_id = _hash_id("prediction", prediction_date, prediction_summary)
    conn.execute(
        """
        INSERT OR IGNORE INTO predictions (
          prediction_id, prediction_summary, prediction_short_label, title,
          reasoning_because, reasoning_given, reasoning_so_that,
          reasoning_landing, plain_language, summary,
          prediction_date, source_file_id, source_row_index, raw_text
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            prediction_id,
            prediction_summary,
            short_label,
            title,
            reasoning_because,
            reasoning_given,
            reasoning_so_that,
            reasoning_landing,
            plain_language,
            summary_text,
            prediction_date,
            source_file_id,
            source_row_index,
            raw_text,
        ),
    )
    # Phase 4b: derive target_*_date from reasoning_landing via the
    # timewindow parser. This was missing — the parser existed but no
    # ingest path called it, so target_*_date stayed NULL on every
    # post-Phase-3 prediction (Phase 4b's runtime validator caught it).
    # parse_time_window returns (None, None) when the landing text has
    # no parseable time expression, so the COALESCE-shape preserves any
    # prior backfilled value.
    target_start, target_end = (None, None)
    if reasoning_landing:
        try:
            from . import timewindow
            # Pass prediction_date as anchor so relative phrases like
            # "Within ~1 quarter" resolve to a (prediction_date,
            # prediction_date + 3mo) range instead of NULL.
            target_start, target_end = timewindow.parse_time_window(
                reasoning_landing, anchor=prediction_date
            )
        except Exception:
            pass

    # Update mutable fields. title field `title`, reasoning fields_*
    # fields, and mid-tier summary `summary` all use COALESCE so a previously-
    # set value is not blanked out by a re-ingest of a legacy or
    # partial news file.
    conn.execute(
        """
        UPDATE predictions SET
          prediction_summary = ?,
          prediction_short_label = ?,
          title              = COALESCE(?, title),
          reasoning_because  = COALESCE(?, reasoning_because),
          reasoning_given    = COALESCE(?, reasoning_given),
          reasoning_so_that  = COALESCE(?, reasoning_so_that),
          reasoning_landing  = COALESCE(?, reasoning_landing),
          plain_language              = COALESCE(?, plain_language),
          summary            = COALESCE(?, summary),
          target_start_date  = COALESCE(?, target_start_date),
          target_end_date    = COALESCE(?, target_end_date),
          prediction_date    = ?,
          source_file_id     = COALESCE(?, source_file_id),
          source_row_index   = COALESCE(?, source_row_index),
          raw_text           = COALESCE(?, raw_text),
          updated_at         = ?
        WHERE prediction_id = ?
        """,
        (
            prediction_summary,
            short_label,
            title,
            reasoning_because,
            reasoning_given,
            reasoning_so_that,
            reasoning_landing,
            plain_language,
            summary_text,
            target_start,
            target_end,
            prediction_date,
            source_file_id,
            source_row_index,
            raw_text,
            _now_iso(),
            prediction_id,
        ),
    )
    return prediction_id


def _upsert_assignment(
    conn: sqlite3.Connection,
    *,
    prediction_id: str,
    scope_id: str,
    category_id: str | None,
    theme_id: str | None,
    subtheme_id: str | None,
    method: str,
    score: float | None,
) -> None:
    conn.execute(
        """
        INSERT INTO prediction_scope_assignments (
          prediction_id, scope_id, category_id, theme_id, subtheme_id,
          assignment_method, assignment_score
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(prediction_id, scope_id) DO UPDATE SET
          category_id=excluded.category_id,
          theme_id=excluded.theme_id,
          subtheme_id=excluded.subtheme_id,
          assignment_method=excluded.assignment_method,
          assignment_score=excluded.assignment_score,
          updated_at=?
        """,
        (
            prediction_id,
            scope_id,
            category_id,
            theme_id,
            subtheme_id,
            method,
            score,
            _now_iso(),
        ),
    )


def _upsert_candidate(
    conn: sqlite3.Connection,
    *,
    scope_id: str,
    prediction_id: str,
    label: str,
    short_label: str,
    description: str,
) -> None:
    candidate_id = _hash_id("candidate", scope_id, prediction_id)
    conn.execute(
        """
        INSERT OR IGNORE INTO theme_candidates (
          candidate_id, scope_id, suggested_theme_label, suggested_short_label,
          suggested_description, origin_prediction_id, candidate_reason, status
        ) VALUES (?, ?, ?, ?, ?, ?, 'no_keyword_match', 'pending')
        """,
        (
            candidate_id,
            scope_id,
            label,
            short_label,
            description,
            prediction_id,
        ),
    )


def _upsert_validation_row(
    conn: sqlite3.Connection,
    *,
    source_file_id: str,
    validation_date: str,
    prediction_id: str | None,
    row: ValidationRow,
) -> str:
    validation_row_id = _hash_id(
        "validation",
        validation_date,
        row.prediction_date or "",
        row.prediction_summary,
    )
    conn.execute(
        """
        INSERT OR REPLACE INTO validation_rows (
          validation_row_id, source_file_id, validation_date, prediction_id,
          prediction_summary, prediction_date, related_items_text,
          reference_links_json, observed_relevance, raw_row_markdown,
          bridge_text, support_dimension
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            validation_row_id,
            source_file_id,
            validation_date,
            prediction_id,
            row.prediction_summary,
            row.prediction_date or None,
            row.related_items_text,
            json.dumps(
                [{"url": e.url, "title": e.title} for e in row.reference_links],
                ensure_ascii=False,
            ),
            row.observed_relevance,
            row.raw_row_markdown,
            row.bridge_text,
            row.support_dimension,
        ),
    )
    # If this validation row is marked [REVIVED] (longshot revival from
    # the dormant pool detected by daily task 2 step 3), stamp the
    # prediction with validation_date so the frontend can light it up
    # for ~2 weeks. Keep the most recent timestamp on repeated hits.
    if row.related_items_text and "[REVIVED]" in row.related_items_text:
        conn.execute(
            "UPDATE predictions SET huge_longshot_hit_at = ? "
            "WHERE prediction_id = ? "
            "AND (huge_longshot_hit_at IS NULL OR huge_longshot_hit_at < ?)",
            (validation_date, prediction_id, validation_date),
        )
    return validation_row_id


def _link_prediction_evidence(
    conn: sqlite3.Connection,
    *,
    prediction_id: str,
    evidence_id: str,
    scope_id: str,
    validation_date: str,
    observed_relevance: int | None,
    contradiction: float,
    is_new: bool,
) -> None:
    from .analytics.scoring import normalize_relevance

    strength = normalize_relevance(observed_relevance)
    conn.execute(
        """
        INSERT OR REPLACE INTO prediction_evidence_links (
          prediction_id, evidence_id, scope_id, support_direction,
          relatedness_score, evidence_strength, contradiction_score,
          evidence_recency_type, validation_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            prediction_id,
            evidence_id,
            scope_id,
            "contradict" if contradiction > 0 and strength < 0.3 else "support",
            strength,
            strength,
            contradiction,
            "new" if is_new else "continuing",
            validation_date,
        ),
    )


# ---------------------------------------------------------------------------
# High-level ingest
# ---------------------------------------------------------------------------


def _ingest_news_file(
    conn: sqlite3.Connection, path: Path, themes: list[ThemeRow]
) -> None:
    report: NewsReport = parse_news_file(path)
    content = path.read_bytes().decode("utf-8", errors="replace")
    source_file_id = _upsert_source_file(
        conn,
        path=path,
        file_type="daily_report",
        report_date=report.report_date,
        content=content,
    )
    for pred in report.predictions:
        _ingest_prediction_summary(
            conn,
            pred=pred,
            report_date=report.report_date,
            source_file_id=source_file_id,
            themes=themes,
        )


def _ingest_prediction_summary(
    conn: sqlite3.Connection,
    *,
    pred: PredictionSummary,
    report_date: str,
    source_file_id: str,
    themes: list[ThemeRow],
) -> None:
    prediction_id = _upsert_prediction(
        conn,
        prediction_summary=pred.summary,
        short_label=pred.short_label,
        prediction_date=report_date,
        source_file_id=source_file_id,
        source_row_index=pred.index,
        raw_text=pred.raw_markdown,
        title=pred.title,
        reasoning_because=pred.reasoning_because,
        reasoning_given=pred.reasoning_given,
        reasoning_so_that=pred.reasoning_so_that,
        reasoning_landing=pred.reasoning_landing,
        plain_language=pred.plain_language,
        summary_text=pred.summary_text,
    )
    match_by_scope = _pick_theme_per_scope(pred.summary, themes)
    # Ensure we always assign to both scopes if possible; if the matcher
    # picked nothing for a scope, record a theme_candidate but still skip
    # the assignment (assignment requires a theme_id).
    for scope_id in ("tech", "business"):
        theme = match_by_scope.get(scope_id)
        if theme is not None:
            _upsert_assignment(
                conn,
                prediction_id=prediction_id,
                scope_id=scope_id,
                category_id=theme.category_id,
                theme_id=theme.theme_id,
                subtheme_id=None,
                method="anchor",
                score=1.0,
            )
        else:
            _upsert_candidate(
                conn,
                scope_id=scope_id,
                prediction_id=prediction_id,
                label=pred.short_label,
                short_label=pred.short_label,
                description=pred.summary[:280],
            )


def _ingest_validation_file(
    conn: sqlite3.Connection, path: Path, themes: list[ThemeRow]
) -> None:
    report: ValidationReport = parse_prediction_file(path)
    content = path.read_bytes().decode("utf-8", errors="replace")
    source_file_id = _upsert_source_file(
        conn,
        path=path,
        file_type="future_prediction_report",
        report_date=report.validation_date,
        content=content,
    )

    from .analytics.scoring import normalize_relevance

    for row in report.rows:
        # Try to match to an existing prediction by (prediction_date,
        # prediction_summary). If the parsed row's summary fuzzily
        # matches a prediction in the DB, we join on that; otherwise we
        # create a placeholder prediction for it.
        prediction_id = _match_or_create_prediction(
            conn,
            row=row,
            themes=themes,
            source_file_id=source_file_id,
        )

        # Contradiction axis retired — kept at 0 in schema for compat.
        contradiction = 0.0
        new_rel = normalize_relevance(row.observed_relevance)
        for scope_id in ("tech", "business"):
            conn.execute(
                """
                UPDATE prediction_scope_assignments
                SET latest_observed_relevance = ?,
                    latest_realization_score = ?,
                    latest_contradiction_score = ?,
                    updated_at = ?
                WHERE prediction_id = ? AND scope_id = ?
                """,
                (
                    row.observed_relevance,
                    new_rel,
                    contradiction,
                    _now_iso(),
                    prediction_id,
                    scope_id,
                ),
            )

        _upsert_validation_row(
            conn,
            source_file_id=source_file_id,
            validation_date=report.validation_date,
            prediction_id=prediction_id,
            row=row,
        )

        # Evidence linking.
        for ev in row.reference_links:
            ev_id = _upsert_evidence(
                conn,
                url=ev.url,
                title=ev.title,
                first_seen=report.validation_date,
                source_file_id=source_file_id,
            )
            # Attach to each scope in which the prediction is assigned.
            cur = conn.execute(
                "SELECT scope_id FROM prediction_scope_assignments WHERE prediction_id = ?",
                (prediction_id,),
            )
            scope_rows = cur.fetchall()
            for sr in scope_rows:
                _link_prediction_evidence(
                    conn,
                    prediction_id=prediction_id,
                    evidence_id=ev_id,
                    scope_id=sr["scope_id"],
                    validation_date=report.validation_date,
                    observed_relevance=row.observed_relevance,
                    contradiction=contradiction,
                    is_new=True,
                )


_MD_NOISE_RE = re.compile(r"[*`_~|>\[\]()\"'“”‘’「」『』【】〈〉《》〔〕]+")
_SEP_RE = re.compile(r"[\s　\-–—×xX+,、。!?！？]+")

# Semantic-fallback threshold. Cosine similarity on multilingual
# MiniLM embeddings comfortably separates "same prediction reworded"
# (0.85+) from "different prediction in the same domain" (~0.50).
SEMANTIC_MATCH_THRESHOLD = 0.75
# Only consult the embedder when the cheap LCS path already failed,
# AND the surface similarity is at least weakly non-zero — avoids
# paying the embedding cost for obviously unrelated pairs.
SEMANTIC_MIN_LCS_RATIO = 0.1

_EMBEDDER = None      # type: ignore[var-annotated]
_EMBED_CACHE: dict[str, "object"] = {}


def _get_embedder():
    """Lazy singleton. Returns None if fastembed is not installed."""
    global _EMBEDDER
    if _EMBEDDER is None:
        try:
            from fastembed import TextEmbedding  # type: ignore
            cache_dir = os.path.expandvars(r"%USERPROFILE%\.cache\fastembed")
            if "%USERPROFILE%" in cache_dir:
                cache_dir = str(Path.home() / ".cache" / "fastembed")
            Path(cache_dir).mkdir(parents=True, exist_ok=True)
            _EMBEDDER = TextEmbedding(
                model_name="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
                cache_dir=cache_dir,
            )
        except Exception:
            _EMBEDDER = False  # sentinel: unavailable
    return _EMBEDDER if _EMBEDDER else None


def _embed(text: str):
    """Return a unit-normalized embedding for ``text``, or None."""
    if not text:
        return None
    norm = _fuzzy_norm(text)
    if not norm:
        return None
    if norm in _EMBED_CACHE:
        return _EMBED_CACHE[norm]
    emb = _get_embedder()
    if emb is None:
        return None
    import numpy as np
    v = list(emb.embed([norm]))[0]
    n = float(np.linalg.norm(v))
    vec = v / (n + 1e-9)
    _EMBED_CACHE[norm] = vec
    return vec


def _cos(a, b) -> float:
    import numpy as np
    return float(np.dot(a, b))


def _fuzzy_norm(s: str) -> str:
    """Normalize a summary for fuzzy matching.

    The Japanese token regex in :func:`_tokens` glues consecutive
    kana+CJK runs into one huge token, so two phrasings that differ
    by a single symbol (``と`` vs ``×``) end up with zero overlap.
    Here we normalize Unicode (NFKC), strip markdown/punctuation, and
    collapse separators to single spaces so downstream comparisons
    operate on a canonical form.
    """
    if not s:
        return ""
    s = unicodedata.normalize("NFKC", s)
    s = _MD_NOISE_RE.sub(" ", s)
    s = _SEP_RE.sub(" ", s)
    return s.strip().lower()


def _fuzzy_match_with_size(a: str, b: str) -> tuple[float, int]:
    """Return (ratio, lcs_size) for two summaries.

    Key signal: length of the longest common substring after
    normalization. A 12+ char shared literal block in Japanese is
    effectively impossible by coincidence (that's a specific clause,
    not a generic phrase), so we short-circuit such matches to 1.0.
    For shorter overlaps we fall back to ``LCS / len(shorter)``.

    English breaks the 12-char heuristic — common verbs and noun
    phrases (``standardize``, ``architecture``) are 12+ chars on their
    own. So callers picking the *best* candidate among multiple
    matches must tie-break by ``lcs_size``, not just ``ratio``;
    returning both makes that explicit at the call site.

    This works around the tokenizer gluing kana+CJK into monolithic
    tokens — which made plain set-overlap brittle when validation
    reports swapped a single middle character (と → ×).
    """
    a = _fuzzy_norm(a)
    b = _fuzzy_norm(b)
    if not a or not b:
        return 0.0, 0
    # autojunk=False: when b is long (>200 chars), SequenceMatcher
    # otherwise treats the very common characters (latin vowels, the
    # kana particle の, spaces) as "junk" and drops them from the
    # matched region, so two strings that literally share a 46-char
    # prefix would report an LCS of 6. Our predictions routinely
    # exceed 200 chars, so we must disable the heuristic.
    sm = SequenceMatcher(None, a, b, autojunk=False)
    m = sm.find_longest_match(0, len(a), 0, len(b))
    if m.size >= 12:
        return 1.0, m.size
    shorter = min(len(a), len(b))
    if shorter == 0:
        return 0.0, m.size
    return m.size / shorter, m.size


def _fuzzy_match_ratio(a: str, b: str) -> float:
    """Scalar form of :func:`_fuzzy_match_with_size`. See its docstring."""
    return _fuzzy_match_with_size(a, b)[0]


def _match_or_create_prediction(
    conn: sqlite3.Connection,
    *,
    row: ValidationRow,
    themes: list[ThemeRow],
    source_file_id: str,
) -> str:
    # Exact-ish match by (prediction_date, prediction_summary).
    #
    # Two-phase:
    #   1. Cheap: normalized longest-common-substring ratio (LCS).
    #      Handles all the common "same sentence, different
    #      punctuation/markdown" cases without any heavy deps.
    #   2. Semantic fallback: if fastembed is installed and nothing
    #      passed phase 1 cleanly, compare multilingual sentence
    #      embeddings (cosine). Catches wording drift that loses the
    #      literal substring (と → × → mid-sentence rewrite).
    if row.prediction_date:
        cur = conn.execute(
            "SELECT prediction_id, prediction_summary FROM predictions WHERE prediction_date = ?",
            (row.prediction_date,),
        )
        candidates = cur.fetchall()
        # Phase 1: tie-break by actual LCS size, not just ratio. The 12-char
        # shortcut in _fuzzy_match_with_size saturates ratio at 1.0 on any
        # generic English noun/verb overlap (``standardize``, ``architecture``),
        # so multiple unrelated candidates routinely tie at 1.0 — the longer
        # actual common substring is the real signal.
        best = None
        best_key: tuple[float, int] = (0.0, 0)
        best_ratio = 0.0
        for r in candidates:
            ratio, lcs = _fuzzy_match_with_size(
                row.prediction_summary, r["prediction_summary"]
            )
            key = (ratio, lcs)
            if key > best_key:
                best_key = key
                best_ratio = ratio
                best = r
        if best is not None and best_ratio >= 0.55:
            return best["prediction_id"]

        # Phase 2 — local semantic matcher, only consulted when the
        # surface-form path already disagreed strongly.
        if candidates and best_ratio < 0.55:
            nv = _embed(row.prediction_summary)
            if nv is not None:
                sem_best = None
                sem_score = 0.0
                for r in candidates:
                    # Skip candidates so surface-dissimilar they'd
                    # be suspicious even if embeddings align.
                    lcs_ratio = _fuzzy_match_ratio(row.prediction_summary, r["prediction_summary"])
                    if lcs_ratio < SEMANTIC_MIN_LCS_RATIO:
                        continue
                    cv = _embed(r["prediction_summary"])
                    if cv is None:
                        continue
                    score = _cos(nv, cv)
                    if score > sem_score:
                        sem_score = score
                        sem_best = r
                if sem_best is not None and sem_score >= SEMANTIC_MATCH_THRESHOLD:
                    return sem_best["prediction_id"]

    # Otherwise create a placeholder prediction so the validation row has
    # a home in the graph. Assign to scopes via the theme matcher.
    placeholder_short = row.prediction_summary[:40] if row.prediction_summary else "Prediction"
    prediction_id = _upsert_prediction(
        conn,
        prediction_summary=row.prediction_summary,
        short_label=placeholder_short,
        prediction_date=row.prediction_date or "",
        source_file_id=source_file_id,
        source_row_index=0,
        raw_text=row.raw_row_markdown,
    )
    match_by_scope = _pick_theme_per_scope(row.prediction_summary, themes)
    for scope_id in ("tech", "business"):
        theme = match_by_scope.get(scope_id)
        if theme is not None:
            _upsert_assignment(
                conn,
                prediction_id=prediction_id,
                scope_id=scope_id,
                category_id=theme.category_id,
                theme_id=theme.theme_id,
                subtheme_id=None,
                method="centroid",
                score=0.5,
            )
    return prediction_id


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


def _stem_to_iso(stem: str, *, prefix: str) -> str | None:
    """Convert a filename stem like ``news-20260424`` -> ``2026-04-24``.

    Returns ``None`` if the stem doesn't match the expected
    ``<prefix><YYYYMMDD>`` shape.
    """
    if not stem.startswith(prefix):
        return None
    rest = stem[len(prefix):]
    if len(rest) < 8 or not rest[:8].isdigit():
        return None
    return f"{rest[0:4]}-{rest[4:6]}-{rest[6:8]}"


def _collect_localized_files(root: Path, pattern: str) -> dict[str, dict[str, Path]]:
    """Group report files by date stem and locale.

    Returns {date_stem: {locale: path, ...}, ...}. Walks
    ``root/<locale>/<pattern>`` for each locale plus flat
    ``root/<pattern>`` (legacy / EN fallback).

    The date stem is the filename without its ``.md`` suffix, e.g.
    ``news-20260424``. Files appearing in both flat and ``en/``
    layouts are deduplicated, with ``en/`` winning.
    """
    out: dict[str, dict[str, Path]] = {}
    # Flat (legacy) — treat as EN unless an explicit en/ file overrides.
    for p in sorted(root.glob(pattern)):
        stem = p.stem
        out.setdefault(stem, {})['en'] = p
    # Per-locale subdirs.
    for loc in LOCALES:
        sub = root / loc
        if not sub.is_dir():
            continue
        for p in sorted(sub.glob(pattern)):
            stem = p.stem
            out.setdefault(stem, {})[loc] = p
    return out


def _canonical_locale(group: dict[str, Path]) -> str:
    """Pick the canonical-source locale for a (date) file group.

    Priority: en > ja > es > fil. EN is canonical by spec; we fall
    back to JA when EN is missing because the user's pre-locale
    corpus lived only in JA. The selected file determines the
    prediction_id (existing hash logic) and supplies the canonical
    English columns; sibling-locale files only fill the *_<locale>
    columns by index match.
    """
    for loc in ('en', 'ja', 'es', 'fil'):
        if loc in group:
            return loc
    # Should be unreachable, but keep deterministic.
    return next(iter(group))


def _update_prediction_locale_cols(
    conn: sqlite3.Connection,
    *,
    prediction_id: str,
    locale: str,
    summary: str,
    short_label: str,
    summary_text: str | None = None,
    title: str | None = None,
    reasoning_because: str | None = None,
    reasoning_given: str | None = None,
    reasoning_so_that: str | None = None,
    reasoning_landing: str | None = None,
    plain_language: str | None = None,
) -> None:
    """Fill *_<locale> columns for a sibling-locale news file.

    Phase 4a: extended beyond prediction_summary / short_label / summary
    (mid-tier) to cover title field title + reasoning fields + plain_language.
    Non-empty values UPDATE; None values are left untouched (COALESCE pattern)
    so a partial sibling parse never clobbers a previously-filled column.
    """
    if locale == 'en':
        return
    if locale not in ('ja', 'es', 'fil'):
        return
    sets = [
        (f"prediction_summary_{locale}", summary),
        (f"prediction_short_label_{locale}", short_label),
        (f"summary_{locale}", summary_text),
        (f"title_{locale}", title),
        (f"reasoning_because_{locale}", reasoning_because),
        (f"reasoning_given_{locale}", reasoning_given),
        (f"reasoning_so_that_{locale}", reasoning_so_that),
        (f"reasoning_landing_{locale}", reasoning_landing),
        (f"plain_language_{locale}", plain_language),
    ]
    # summary + short_label are always written when sibling parse succeeds;
    # the rest use COALESCE so a parser miss doesn't overwrite a prior value.
    pieces = []
    args: list = []
    for col, val in sets:
        if col.startswith(("prediction_summary_", "prediction_short_label_")):
            pieces.append(f"{col} = ?")
            args.append(val)
        else:
            pieces.append(f"{col} = COALESCE(?, {col})")
            args.append(val)
    pieces.append("updated_at = ?")
    args.append(_now_iso())
    args.append(prediction_id)
    conn.execute(
        f"UPDATE predictions SET {', '.join(pieces)} WHERE prediction_id = ?",
        args,
    )


def _ingest_localized_news_group(
    conn: sqlite3.Connection,
    *,
    stem: str,
    group: dict[str, Path],
    themes: list[ThemeRow],
) -> None:
    """Ingest one date's news files across all available locales.

    The canonical-locale file is parsed first and produces the
    prediction rows. Sibling locale files are then parsed and their
    n-th numbered prediction is mapped to the n-th canonical
    prediction's row (by index), filling prediction_summary_<locale>
    and prediction_short_label_<locale>.
    """
    canon_locale = _canonical_locale(group)
    canon_path = group[canon_locale]

    if canon_locale != 'en':
        import warnings
        warnings.warn(
            f"news file group {stem!r} has no EN canonical source; "
            f"using {canon_locale!r} as canonical (locale columns "
            f"for EN will fall back to {canon_locale!r}).",
            stacklevel=2,
        )

    canon_report = parse_news_file(canon_path)
    canon_content = canon_path.read_bytes().decode('utf-8', errors='replace')
    canon_source_file_id = _upsert_source_file(
        conn,
        path=canon_path,
        file_type='daily_report',
        report_date=canon_report.report_date,
        content=canon_content,
        locale=canon_locale,
    )

    # Map index -> prediction_id for the canonical file so we can
    # back-fill the sibling-locale columns by index match.
    canon_pred_ids: dict[int, str] = {}
    for pred in canon_report.predictions:
        prediction_id = _upsert_prediction(
            conn,
            prediction_summary=pred.summary,
            short_label=pred.short_label,
            prediction_date=canon_report.report_date,
            source_file_id=canon_source_file_id,
            source_row_index=pred.index,
            raw_text=pred.raw_markdown,
            title=pred.title,
            reasoning_because=pred.reasoning_because,
            reasoning_given=pred.reasoning_given,
            reasoning_so_that=pred.reasoning_so_that,
            reasoning_landing=pred.reasoning_landing,
            plain_language=pred.plain_language,
            summary_text=pred.summary_text,
        )
        canon_pred_ids[pred.index] = prediction_id
        match_by_scope = _pick_theme_per_scope(pred.summary, themes)
        for scope_id in ('tech', 'business'):
            theme = match_by_scope.get(scope_id)
            if theme is not None:
                _upsert_assignment(
                    conn,
                    prediction_id=prediction_id,
                    scope_id=scope_id,
                    category_id=theme.category_id,
                    theme_id=theme.theme_id,
                    subtheme_id=None,
                    method='anchor',
                    score=1.0,
                )
            else:
                _upsert_candidate(
                    conn,
                    scope_id=scope_id,
                    prediction_id=prediction_id,
                    label=pred.short_label,
                    short_label=pred.short_label,
                    description=pred.summary[:280],
                )

    # Now sibling locales -> fill *_locale columns.
    for loc, lpath in group.items():
        if loc == canon_locale:
            continue
        try:
            sib_report = parse_news_file(lpath)
        except Exception:
            continue
        sib_content = lpath.read_bytes().decode('utf-8', errors='replace')
        # Track the source file too so its row appears in source_files.
        _upsert_source_file(
            conn,
            path=lpath,
            file_type='daily_report',
            report_date=sib_report.report_date,
            content=sib_content,
            locale=loc,
        )
        for pred in sib_report.predictions:
            target_pid = canon_pred_ids.get(pred.index)
            if target_pid is None:
                continue
            _update_prediction_locale_cols(
                conn,
                prediction_id=target_pid,
                locale=loc,
                summary=pred.summary,
                short_label=pred.short_label,
                summary_text=pred.summary_text,
                title=pred.title,
                reasoning_because=pred.reasoning_because,
                reasoning_given=pred.reasoning_given,
                reasoning_so_that=pred.reasoning_so_that,
                reasoning_landing=pred.reasoning_landing,
                plain_language=pred.plain_language,
            )


def _ingest_localized_validation_group(
    conn: sqlite3.Connection,
    *,
    stem: str,
    group: dict[str, Path],
    themes: list[ThemeRow],
) -> None:
    """Ingest a date's future-prediction (validation) files across locales.

    Canonical-locale validation rows drive matching/linking. Sibling
    locales contribute prediction_summary_<locale> back-fills on the
    matched validation_rows row by index.
    """
    canon_locale = _canonical_locale(group)
    canon_path = group[canon_locale]
    if canon_locale != 'en':
        import warnings
        warnings.warn(
            f"validation file group {stem!r} has no EN canonical source; "
            f"using {canon_locale!r} as canonical.",
            stacklevel=2,
        )
    # Reuse the existing single-file ingest, then back-fill locales.
    _ingest_validation_file(conn, canon_path, themes)
    # Update the source_files row to record the right locale (the
    # generic helper inside _ingest_validation_file defaulted it to 'en').
    rel = str(canon_path.relative_to(repo_root())).replace('\\', '/')
    conn.execute(
        "UPDATE source_files SET locale = ? WHERE path = ?",
        (canon_locale, rel),
    )

    # Pull the validation row IDs we just inserted, in source order, so
    # we can back-fill *_<locale> by index match against sibling parses.
    # ORDER BY rowid: SQLite's implicit insertion-order column. The previous
    # ORDER BY validation_row_id sorted by hash, which scrambled the order
    # relative to the sibling parser's source-order iteration and caused
    # locale fan-out to write the wrong prediction's bridge text into each
    # row (e.g. JA "Powell" text landing on the EN "Headless Everything"
    # row because their hash positions happened to align).
    cur = conn.execute(
        """
        SELECT vr.validation_row_id
        FROM validation_rows vr
        JOIN source_files sf ON vr.source_file_id = sf.source_file_id
        WHERE sf.path = ?
        ORDER BY vr.rowid
        """,
        (rel,),
    )
    canon_row_ids = [r['validation_row_id'] for r in cur.fetchall()]

    for loc, lpath in group.items():
        if loc == canon_locale:
            continue
        try:
            sib_report = parse_prediction_file(lpath)
        except Exception:
            continue
        sib_content = lpath.read_bytes().decode('utf-8', errors='replace')
        _upsert_source_file(
            conn,
            path=lpath,
            file_type='future_prediction_report',
            report_date=sib_report.validation_date,
            content=sib_content,
            locale=loc,
        )
        if loc not in ('ja', 'es', 'fil'):
            continue
        sum_col = f"prediction_summary_{loc}"
        bridge_col = f"bridge_text_{loc}"
        for idx, row in enumerate(sib_report.rows):
            if idx >= len(canon_row_ids):
                break
            conn.execute(
                f"UPDATE validation_rows SET {sum_col} = ?, "
                f"{bridge_col} = COALESCE(?, {bridge_col}) "
                f"WHERE validation_row_id = ?",
                (row.prediction_summary, row.bridge_text, canon_row_ids[idx]),
            )


def run_ingest(
    db_path: Path | None = None,
    *,
    skip_dates: set[str] | None = None,
) -> dict:
    """Ingest all available markdown files. Returns a small report dict.

    Locale-aware (feature/locale branch): walks
    ``report/{en,ja,es,fil}/news-*.md`` and same for
    ``future-prediction/``. Flat ``report/news-*.md`` is still
    accepted as legacy/EN. The EN file (or the first available
    locale) is the canonical source for each date; sibling-locale
    files contribute *_<locale> column back-fills.

    ``skip_dates`` (Phase 4 fallback path) lets the caller exclude
    dates that have already been ingested via the sourcedata path —
    re-running the markdown ingest for a date that has a JSON-derived
    canonical row would create a duplicate row because the regenerated
    markdown's ``pred.summary`` is layout-different from the original
    JSON ``body``, producing a different prediction-id hash.
    """
    skip = set(skip_dates or ())
    conn = connect(db_path) if db_path else connect()
    try:
        themes = _load_themes(conn)

        news_groups = _collect_localized_files(report_dir(), "news-*.md")
        for stem in sorted(news_groups):
            # stem like "news-20260424"; convert to ISO and skip if
            # already ingested from sourcedata.
            date_iso = _stem_to_iso(stem, prefix="news-")
            if date_iso and date_iso in skip:
                continue
            _ingest_localized_news_group(
                conn,
                stem=stem,
                group=news_groups[stem],
                themes=themes,
            )

        validation_groups = _collect_localized_files(
            future_prediction_dir(), "future-prediction-*.md"
        )
        for stem in sorted(validation_groups):
            date_iso = _stem_to_iso(stem, prefix="future-prediction-")
            if date_iso and date_iso in skip:
                continue
            _ingest_localized_validation_group(
                conn,
                stem=stem,
                group=validation_groups[stem],
                themes=themes,
            )

        conn.commit()
        # Counts the number of unique dates ingested per type so the
        # caller can still log a sensible "N files" line.
        news_count = sum(len(g) for g in news_groups.values())
        validation_count = sum(len(g) for g in validation_groups.values())
        return {
            "news_files": news_count,
            "validation_files": validation_count,
        }
    finally:
        conn.close()
