"""Export the SQLite analytics DB to static JSON under ``docs/data/``.

Contract: ``design/export_layer.md`` and ``design/UI (1).md`` sections 5.1-5.4.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
import sqlite3
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from .analytics.windows import WINDOWS, parse_iso_date, window_range
from .db import connect, repo_root
from .parsers.news_parser import BOLD_RE, _derive_short_label
from .timewindow import parse_week_bucket


def _bold_hint(s: str | None) -> str | None:
    """Extract the leading `**bold**` title from a prediction summary,
    matching the parser's pre-derivation step. Without this, summaries
    that begin with `**Title.** Body...` make _derive_short_label
    return the whole markdown blob."""
    if not s:
        return None
    m = BOLD_RE.search(s)
    return m.group(1).strip() if m else None


SCHEMA_VERSION = "1.0"

# Locales the dashboard understands. EN is the canonical fallback for
# every translated field. Per-field fallback: if labels.ja is NULL on
# a node, the exporter emits labels.ja = labels.en for that node so
# the frontend never has to hard-code the fallback.
LOCALES = ("en", "ja", "es", "fil")
DEFAULT_LOCALE = "en"


def _locale_field(row, base_field: str) -> dict:
    """Build a {en, ja, es, fil} dict for a SQLite row's text field.

    Reads ``base_field`` (canonical EN) and ``base_field_ja``,
    ``base_field_es``, ``base_field_fil``. NULL locale values fall
    back to the canonical EN value so the frontend can index
    ``node.labels.ja`` without a guard.
    """
    en = None
    try:
        en = row[base_field]
    except (KeyError, IndexError):
        en = None
    out = {"en": en}
    for loc in ("ja", "es", "fil"):
        col = f"{base_field}_{loc}"
        v = None
        try:
            v = row[col]
        except (KeyError, IndexError):
            v = None
        out[loc] = v if v else en
    return out


def _locale_pair(en_value, ja_value, es_value, fil_value) -> dict:
    """Like _locale_field but takes already-extracted values.

    Used for prediction nodes where the canonical column name is
    ``prediction_summary`` but the EN value comes pre-derived in
    code (e.g. truncated label).
    """
    return {
        "en": en_value,
        "ja": ja_value if ja_value else en_value,
        "es": es_value if es_value else en_value,
        "fil": fil_value if fil_value else en_value,
    }

def _loc(en, ja, es, fil):
    """Build a 4-locale dict, falling back to EN when a locale is None."""
    return {"en": en, "ja": ja or en, "es": es or en, "fil": fil or en}


# Token regex for IDF-weighted cross-theme matching. Mirrors ingest._tokens.
_TOKEN_RE = re.compile(r"[A-Za-z0-9]+|[぀-ヿ一-鿿]+")


def _tok(s: str) -> set[str]:
    if not s:
        return set()
    return {t.lower() for t in _TOKEN_RE.findall(s) if len(t) >= 2}


# Secondary matches are kept when their IDF score is >= (best * threshold).
SECONDARY_THEME_THRESHOLD = 0.55


def docs_data_dir() -> Path:
    return repo_root() / "docs" / "data"


# Backwards-compatible alias in case anything else imports the old name.
pages_data_dir = docs_data_dir


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _hid(prefix: str, *parts: str) -> str:
    h = hashlib.sha1("||".join(parts).encode("utf-8")).hexdigest()[:16]
    return f"{prefix}.{h}"


def _load_dormant_set() -> set[tuple[str, int]]:
    """Return the set of (prediction_date, source_row_index) tuples that the
    latest dormant snapshot lists. Empty set when there is no snapshot.

    The dormant pool is the persistent state of "predictions parked for
    longshot revival" maintained by Task 4 (`design/scheduled/4_weekly_memory.md`).
    Its snapshot file `memory/dormant/dormant-YYYYMMDD.md` carries a markdown
    table whose first column holds IDs of the form ``YYYYMMDD-N`` — N is
    the predicition's source_row_index in its origin news file. Mapping
    that pair back to a prediction_id is straightforward at the join time;
    the export only needs to know "is this (date, index) in the pool" so a
    boolean ``detail.dormant`` flag can be attached to the node.

    This is intentionally separate from the per-window metric gate. Window
    visibility (7d / 30d / 90d) is a *display freshness* concern handled
    on the frontend by comparing detail.prediction_date against the active
    window. Dormancy is a *display-worthiness* concern that applies across
    all windows and is sourced exclusively from the pool snapshot.
    """
    import re
    dormant_dir = repo_root() / "memory" / "dormant"
    if not dormant_dir.is_dir():
        return set()
    snapshots = sorted(dormant_dir.glob("dormant-*.md"))
    if not snapshots:
        return set()
    latest = snapshots[-1]
    try:
        text = latest.read_text(encoding="utf-8")
    except OSError:
        return set()
    out: set[tuple[str, int]] = set()
    # Find every table row whose first cell matches YYYYMMDD-N, ignoring
    # rows under the markdown table header / separator.
    row_re = re.compile(r"^\|\s*(\d{8})-(\d+)\s*\|", re.MULTILINE)
    for m in row_re.finditer(text):
        d, n = m.group(1), int(m.group(2))
        iso = f"{d[0:4]}-{d[4:6]}-{d[6:8]}"
        out.add((iso, n))
    return out


def _rel_to_repo(path: Path) -> str:
    """Return path relative to the repo root, or the absolute path as a
    forward-slashed string when the path lives outside it (common in
    tests where output is written to a temp directory)."""
    try:
        rel = path.resolve().relative_to(repo_root())
    except ValueError:
        return str(path).replace("\\", "/")
    return str(rel).replace("\\", "/")


def _blank_metric_bundle(
    node_type: str,
) -> dict:
    status = "no_signal" if node_type == "prediction" else "dormant"
    return {
        "attention_score": 0.0,
        "realization_score": 0.0,
        "contradiction_score": 0.0,
        "grass_level": 0,
        "streak_days": 0,
        "new_signal": 0.0,
        "continuing_signal": 0.0,
        "status": status,
    }


def _metric_bundle_theme(row: sqlite3.Row) -> dict:
    return {
        "attention_score": row["attention_score"] or 0.0,
        "realization_score": row["realization_score"] or 0.0,
        "contradiction_score": row["contradiction_signal"] or 0.0,
        "grass_level": row["grass_level"] or 0,
        "streak_days": row["streak_days"] or 0,
        "new_signal": row["new_signal"] or 0.0,
        "continuing_signal": row["continuing_signal"] or 0.0,
        "status": row["status"] or "dormant",
    }


def _metric_bundle_category(row: sqlite3.Row) -> dict:
    return {
        "attention_score": row["attention_score"] or 0.0,
        "realization_score": row["realization_score"] or 0.0,
        "contradiction_score": row["contradiction_signal"] or 0.0,
        "grass_level": row["grass_level"] or 0,
        "streak_days": 0,
        "new_signal": 0.0,
        "continuing_signal": 0.0,
        "status": row["status"] or "dormant",
    }


def _metric_bundle_prediction(row: sqlite3.Row) -> dict:
    realization = row["realization_score"] or 0.0
    contradiction = row["contradiction_score"] or 0.0
    new_rel = row["new_evidence_relevance"] or 0.0
    cont_rel = row["continuing_evidence_relevance"] or 0.0
    attention = max(new_rel, cont_rel, realization)
    if attention > 1.0:
        attention = 1.0
    # grass_level inline to avoid circular imports
    if attention <= 0.05:
        gl = 0
    elif attention <= 0.25:
        gl = 1
    elif attention <= 0.5:
        gl = 2
    elif attention <= 0.75:
        gl = 3
    else:
        gl = 4
    return {
        "attention_score": attention,
        "realization_score": realization,
        "contradiction_score": contradiction,
        "grass_level": gl,
        "streak_days": 0,
        "new_signal": new_rel,
        "continuing_signal": cont_rel,
        "status": row["observation_status"] or "no_signal",
    }


# ---------------------------------------------------------------------------
# Layout helpers — deterministic ring placement
# ---------------------------------------------------------------------------


def _ring_layout(count: int, radius: float) -> list[tuple[float, float]]:
    if count <= 0:
        return []
    return [
        (
            radius * math.cos(2 * math.pi * i / count),
            radius * math.sin(2 * math.pi * i / count),
        )
        for i in range(count)
    ]


# ---------------------------------------------------------------------------
# Scope graph builder
# ---------------------------------------------------------------------------


@dataclass
class GraphNode:
    id: str
    type: str
    scope_id: str
    label: str
    short_label: str
    description: str | None
    category_id: str | None
    theme_id: str | None
    subtheme_id: str | None
    prediction_id: str | None
    parent_ids: list[str]
    child_ids: list[str]
    metrics_by_window: dict[str, dict]
    visibility: dict
    layout: dict
    detail: dict


def _latest_report_date(conn: sqlite3.Connection) -> str | None:
    cur = conn.execute(
        "SELECT MAX(report_date) AS d FROM source_files WHERE file_type='daily_report'"
    )
    row = cur.fetchone()
    return row["d"] if row and row["d"] else None


def _earliest_report_date(conn: sqlite3.Connection) -> str | None:
    cur = conn.execute(
        "SELECT MIN(report_date) AS d FROM source_files WHERE file_type='daily_report'"
    )
    row = cur.fetchone()
    return row["d"] if row and row["d"] else None


def _build_evidence_cluster_index(
    conn: sqlite3.Connection, scope_id: str
) -> tuple[dict[str, str], dict[str, list[dict]]]:
    """Group evidence items into clusters by (theme_id, week_bucket).

    A cluster represents "similar observations arriving together":
    same theme + same ISO week of `first_seen_date`. Used by the
    Readings tab to surface cluster density (how many similar
    observations support a prediction) and frequency (whether the
    cluster is accelerating, flat, or decelerating).

    Returns:
        evidence_to_cluster: {evidence_id: cluster_key}
        cluster_to_evidence: {cluster_key: [{evidence_id, theme_id,
                              week_bucket, first_seen_date}, ...]}

    Cluster key format: ``"{theme_id}|{week_bucket}"`` where
    week_bucket is ``strftime('%Y-%W', first_seen_date)``.
    Evidence without an assigned theme_id or first_seen_date is
    excluded from the index (returns empty mapping for them).
    """
    # Derive each evidence's "primary theme" from the predictions that
    # cite it. evidence_scope_assignments would be the canonical source
    # but the ingest pipeline doesn't populate it today, so we fall
    # back to: theme_id = the most-cited theme among predictions
    # linking to this evidence within the requested scope. Ties broken
    # by theme_id alphabetical for determinism.
    cur = conn.execute(
        """
        WITH ev_theme_counts AS (
            SELECT pel.evidence_id, psa.theme_id, COUNT(*) AS cnt
            FROM prediction_evidence_links pel
            JOIN prediction_scope_assignments psa
              ON pel.prediction_id = psa.prediction_id
             AND pel.scope_id = psa.scope_id
            WHERE pel.scope_id = ? AND psa.theme_id IS NOT NULL
            GROUP BY pel.evidence_id, psa.theme_id
        ),
        ranked AS (
            SELECT evidence_id, theme_id, cnt,
                   ROW_NUMBER() OVER (
                     PARTITION BY evidence_id
                     ORDER BY cnt DESC, theme_id
                   ) AS rn
            FROM ev_theme_counts
        )
        SELECT r.evidence_id, r.theme_id,
               strftime('%Y-%W', ev.first_seen_date) AS week_bucket,
               ev.first_seen_date
        FROM ranked r
        JOIN evidence_items ev ON r.evidence_id = ev.evidence_id
        WHERE r.rn = 1 AND ev.first_seen_date IS NOT NULL
        """,
        (scope_id,),
    )
    evidence_to_cluster: dict[str, str] = {}
    cluster_to_evidence: dict[str, list[dict]] = {}
    for row in cur.fetchall():
        ck = f"{row['theme_id']}|{row['week_bucket']}"
        evidence_to_cluster[row["evidence_id"]] = ck
        cluster_to_evidence.setdefault(ck, []).append({
            "evidence_id": row["evidence_id"],
            "theme_id": row["theme_id"],
            "week_bucket": row["week_bucket"],
            "first_seen_date": row["first_seen_date"],
        })
    return evidence_to_cluster, cluster_to_evidence


def _compute_cluster_trend(
    cluster_evidences: list[dict],
    latest_date: str | None,
) -> str:
    """Classify cluster frequency trend over the recent 4 weeks.

    Compares the last 2 weeks vs the preceding 2 weeks of cluster
    arrivals. Returns one of:

    - ``accelerating``: recent count > 1.5x the prior 2-week count
      (frequency is rising — the world is producing more similar
      observations).
    - ``decelerating``: recent count < 0.7x the prior count
      (frequency is dropping — the cluster is fading).
    - ``flat``: no clear direction.

    A cluster with < 4 weeks of history (or no anchor date) returns
    ``flat`` to avoid noisy classification.
    """
    if not cluster_evidences or not latest_date:
        return "flat"
    try:
        from datetime import date as _date
        latest = _date.fromisoformat(latest_date)
    except (ValueError, TypeError):
        return "flat"
    weeks_back: dict[int, int] = {}
    for ev in cluster_evidences:
        try:
            d = _date.fromisoformat(ev["first_seen_date"])
        except (ValueError, TypeError, KeyError):
            continue
        delta = (latest - d).days
        if delta < 0 or delta > 28:
            continue
        wk = delta // 7
        weeks_back[wk] = weeks_back.get(wk, 0) + 1
    recent = weeks_back.get(0, 0) + weeks_back.get(1, 0)
    prior = weeks_back.get(2, 0) + weeks_back.get(3, 0)
    if recent == 0 and prior == 0:
        return "flat"
    if prior == 0:
        return "accelerating" if recent >= 2 else "flat"
    if recent > prior * 1.5:
        return "accelerating"
    if recent < prior * 0.7:
        return "decelerating"
    return "flat"


def _load_layout_map(
    conn: sqlite3.Connection, scope_id: str
) -> dict[str, dict]:
    cur = conn.execute(
        "SELECT node_id, x, y, z, radius, fixed FROM graph_node_layouts WHERE scope_id = ?",
        (scope_id,),
    )
    return {
        r["node_id"]: {
            "x": r["x"],
            "y": r["y"],
            "z": r["z"] or 0.0,
            "radius": r["radius"],
            "fixed": bool(r["fixed"]),
        }
        for r in cur.fetchall()
    }


def _theme_metric_lookup(
    conn: sqlite3.Connection, scope_id: str, latest: str
) -> dict[tuple[str, str], dict]:
    """Return {(theme_id, window_id): metrics_bundle} for a scope on ``latest``."""
    cur = conn.execute(
        """
        SELECT theme_id, window_id, attention_score, realization_score,
               contradiction_signal, grass_level, new_signal, continuing_signal,
               status, streak_days
        FROM topic_daily_activity
        WHERE scope_id = ? AND activity_level = 'theme' AND activity_date = ?
        """,
        (scope_id, latest),
    )
    out: dict[tuple[str, str], dict] = {}
    for r in cur.fetchall():
        out[(r["theme_id"], r["window_id"])] = _metric_bundle_theme(r)
    return out


def _category_metric_lookup(
    conn: sqlite3.Connection, scope_id: str, latest: str
) -> dict[tuple[str, str], dict]:
    cur = conn.execute(
        """
        SELECT category_id, window_id, attention_score, realization_score,
               contradiction_signal, grass_level, status
        FROM category_daily_activity
        WHERE scope_id = ? AND activity_date = ?
        """,
        (scope_id, latest),
    )
    out: dict[tuple[str, str], dict] = {}
    for r in cur.fetchall():
        out[(r["category_id"], r["window_id"])] = _metric_bundle_category(r)
    return out


def _grass_level_for(attn: float) -> int:
    if attn <= 0.05:
        return 0
    if attn <= 0.25:
        return 1
    if attn <= 0.5:
        return 2
    if attn <= 0.75:
        return 3
    return 4


def _theme_grass_daily(
    conn: sqlite3.Connection,
    scope_id: str,
    windows_ranges: dict[str, tuple[str, str]],
) -> dict[tuple[str, str], list[dict]]:
    """``{(theme_id, window_id): [{date, grass_level, attention_score}, …]}``

    Roll ``prediction_evidence_links`` for predictions assigned to each
    theme by ``validation_date``. The per-day attention is the summed
    evidence strength within the day's relevance fed through the
    same saturator used by the window aggregate, so an active day
    reads full-grass (4) while a single relevance-3 hit reads mid.
    """
    out: dict[tuple[str, str], list[dict]] = {}
    for wid, (start, end) in windows_ranges.items():
        cur = conn.execute(
            """
            SELECT psa.theme_id AS theme_id,
                   pel.validation_date AS d,
                   SUM(COALESCE(pel.evidence_strength, 0)) AS s
            FROM prediction_evidence_links pel
            JOIN prediction_scope_assignments psa
              ON pel.prediction_id = psa.prediction_id
             AND pel.scope_id = psa.scope_id
            WHERE psa.scope_id = ?
              AND psa.theme_id IS NOT NULL
              AND pel.validation_date BETWEEN ? AND ?
            GROUP BY psa.theme_id, pel.validation_date
            ORDER BY psa.theme_id, pel.validation_date
            """,
            (scope_id, start, end),
        )
        for r in cur.fetchall():
            # Mirror scoring.new_signal_from_sum: saturate at 3.0.
            attn = min(1.0, float(r["s"] or 0.0) / 3.0)
            out.setdefault((r["theme_id"], wid), []).append({
                "date": r["d"],
                "grass_level": _grass_level_for(attn),
                "attention_score": attn,
            })
    return out


def _category_grass_daily(
    conn: sqlite3.Connection,
    scope_id: str,
    windows_ranges: dict[str, tuple[str, str]],
) -> dict[tuple[str, str], list[dict]]:
    """Per-day rollup for each category: strongest of its themes that day."""
    out: dict[tuple[str, str], list[dict]] = {}
    for wid, (start, end) in windows_ranges.items():
        cur = conn.execute(
            """
            SELECT psa.category_id AS category_id,
                   pel.validation_date AS d,
                   SUM(COALESCE(pel.evidence_strength, 0)) AS s
            FROM prediction_evidence_links pel
            JOIN prediction_scope_assignments psa
              ON pel.prediction_id = psa.prediction_id
             AND pel.scope_id = psa.scope_id
            WHERE psa.scope_id = ?
              AND psa.category_id IS NOT NULL
              AND pel.validation_date BETWEEN ? AND ?
            GROUP BY psa.category_id, pel.validation_date
            ORDER BY psa.category_id, pel.validation_date
            """,
            (scope_id, start, end),
        )
        for r in cur.fetchall():
            attn = min(1.0, float(r["s"] or 0.0) / 3.0)
            out.setdefault((r["category_id"], wid), []).append({
                "date": r["d"],
                "grass_level": _grass_level_for(attn),
                "attention_score": attn,
            })
    return out


def _prediction_grass_daily(
    conn: sqlite3.Connection,
    scope_id: str,
    windows_ranges: dict[str, tuple[str, str]],
) -> dict[tuple[str, str], list[dict]]:
    """Roll prediction_evidence_links into per-day grass entries.

    For each (prediction, window) we emit one entry per distinct
    validation_date where the prediction had at least one evidence link,
    using max(evidence_strength) as the day's attention proxy.
    """
    out: dict[tuple[str, str], list[dict]] = {}
    for wid, (start, end) in windows_ranges.items():
        cur = conn.execute(
            """
            SELECT prediction_id, validation_date,
                   MAX(evidence_strength) AS attn
            FROM prediction_evidence_links
            WHERE scope_id = ?
              AND validation_date BETWEEN ? AND ?
            GROUP BY prediction_id, validation_date
            ORDER BY validation_date
            """,
            (scope_id, start, end),
        )
        for r in cur.fetchall():
            attn = float(r["attn"] or 0.0)
            if attn <= 0.05:
                gl = 0
            elif attn <= 0.25:
                gl = 1
            elif attn <= 0.5:
                gl = 2
            elif attn <= 0.75:
                gl = 3
            else:
                gl = 4
            out.setdefault((r["prediction_id"], wid), []).append({
                "date": r["validation_date"],
                "grass_level": gl,
                "attention_score": attn,
            })
    return out


def _prediction_metric_lookup(
    conn: sqlite3.Connection, scope_id: str
) -> dict[tuple[str, str], dict]:
    cur = conn.execute(
        """
        SELECT prs.prediction_id, prs.window_id, prs.new_evidence_relevance,
               prs.continuing_evidence_relevance, prs.realization_score,
               prs.contradiction_score, prs.observation_status
        FROM prediction_realization_snapshots prs
        JOIN (
          SELECT prediction_id, scope_id, window_id, MAX(validation_date) AS d
          FROM prediction_realization_snapshots
          WHERE scope_id = ?
          GROUP BY prediction_id, scope_id, window_id
        ) latest
          ON prs.prediction_id = latest.prediction_id
         AND prs.scope_id = latest.scope_id
         AND prs.window_id = latest.window_id
         AND prs.validation_date = latest.d
        WHERE prs.scope_id = ?
        """,
        (scope_id, scope_id),
    )
    out: dict[tuple[str, str], dict] = {}
    for r in cur.fetchall():
        out[(r["prediction_id"], r["window_id"])] = _metric_bundle_prediction(r)
    return out


def _build_scope_graph(conn: sqlite3.Connection, scope_id: str) -> dict:
    latest = _latest_report_date(conn)
    earliest = _earliest_report_date(conn) or latest
    latest_d = parse_iso_date(latest) if latest else None

    # Load taxonomy (with locale columns; NULL means fall back to EN).
    cur = conn.execute(
        """
        SELECT category_id, label, short_label, description, sort_order,
               label_ja, label_es, label_fil,
               short_label_ja, short_label_es, short_label_fil,
               description_ja, description_es, description_fil
        FROM categories WHERE scope_id = ? AND active = 1 ORDER BY sort_order
        """,
        (scope_id,),
    )
    categories = list(cur.fetchall())

    cur = conn.execute(
        """
        SELECT theme_id, category_id, canonical_label, short_label, description,
               label_ja, label_es, label_fil,
               short_label_ja, short_label_es, short_label_fil,
               description_ja, description_es, description_fil
        FROM themes
        WHERE scope_id = ? AND status IN ('active', 'candidate')
        """,
        (scope_id,),
    )
    themes = list(cur.fetchall())

    # Build IDF-weighted token sets per theme so a single prediction can
    # legitimately attach to multiple themes (1:N). Shared tokens like
    # "agent" or "ai" get small weight; rare tokens dominate the score.
    theme_tokens_list: list[set[str]] = []
    for th in themes:
        ts = _tok(th["canonical_label"]) | _tok(th["short_label"] or "") | _tok(th["description"] or "")
        theme_tokens_list.append(ts)
    df: dict[str, int] = {}
    for ts in theme_tokens_list:
        for tok in ts:
            df[tok] = df.get(tok, 0) + 1

    def extra_theme_parents(summary: str, primary_theme_id: str) -> list[str]:
        """IDF-weighted secondary theme picks. Excludes the primary."""
        toks = _tok(summary)
        if not toks:
            return []
        scored: list[tuple[float, str, str]] = []
        for th, t_tokens in zip(themes, theme_tokens_list):
            s = sum(1.0 / df[t] for t in (toks & t_tokens) if df.get(t, 0) > 0)
            if s > 0:
                scored.append((s, th["theme_id"], th["category_id"]))
        if not scored:
            return []
        best = max(s for s, *_ in scored)
        if best <= 0:
            return []
        thresh = best * SECONDARY_THEME_THRESHOLD
        return [
            th_id for (s, th_id, _cat) in scored
            if s >= thresh and th_id != primary_theme_id
        ]

    cur = conn.execute(
        """
        SELECT st.subtheme_id, st.theme_id, st.canonical_label, st.short_label,
               st.description, t.category_id,
               st.label_ja, st.label_es, st.label_fil,
               st.short_label_ja, st.short_label_es, st.short_label_fil,
               st.description_ja, st.description_es, st.description_fil
        FROM subthemes st
        JOIN themes t ON st.theme_id = t.theme_id
        WHERE t.scope_id = ? AND st.status IN ('active', 'candidate')
        """,
        (scope_id,),
    )
    subthemes = list(cur.fetchall())

    cur = conn.execute(
        """
        SELECT p.prediction_id, p.prediction_summary, p.prediction_short_label,
               p.prediction_date, p.source_row_index, sf.path AS source_path,
               p.prediction_summary_ja, p.prediction_summary_es, p.prediction_summary_fil,
               p.prediction_short_label_ja, p.prediction_short_label_es, p.prediction_short_label_fil,
               p.huge_longshot_hit_at,
               -- title field: dedicated title column. NULL for predictions
               -- ingested before the column was added; the dashboard's
               -- `cleanPredictionTitle` fallback handles those.
               p.title AS prediction_title,
               -- reasoning fields: reasoning trace. NULL until the writer fills
               -- them in. The frontend Reasoning tab hides empty fields.
               p.reasoning_because, p.reasoning_given,
               p.reasoning_so_that, p.reasoning_landing, p.eli14,
               -- Phase 4a: locale fan-out for title / reasoning + eli14.
               p.title_ja, p.title_es, p.title_fil,
               p.reasoning_because_ja, p.reasoning_because_es, p.reasoning_because_fil,
               p.reasoning_given_ja, p.reasoning_given_es, p.reasoning_given_fil,
               p.reasoning_so_that_ja, p.reasoning_so_that_es, p.reasoning_so_that_fil,
               p.reasoning_landing_ja, p.reasoning_landing_es, p.reasoning_landing_fil,
               p.eli14_ja, p.eli14_es, p.eli14_fil,
               -- Phase 3: structured time bounds derived from
               -- reasoning_landing. Prediction's destination window.
               p.target_start_date, p.target_end_date,
               -- mid-tier summary: mid-tier summary + locale fan-out. NULL on
               -- legacy items; frontend falls back to title + collapsed
               -- full text only when the middle tier is missing.
               p.summary AS pred_summary,
               p.summary_ja AS pred_summary_ja,
               p.summary_es AS pred_summary_es,
               p.summary_fil AS pred_summary_fil,
               psa.category_id, psa.theme_id, psa.subtheme_id,
               psa.latest_realization_score, psa.latest_contradiction_score,
               psa.latest_observed_relevance, psa.latest_observation_status
        FROM predictions p
        JOIN prediction_scope_assignments psa ON p.prediction_id = psa.prediction_id
        LEFT JOIN source_files sf ON p.source_file_id = sf.source_file_id
        WHERE psa.scope_id = ? AND psa.theme_id IS NOT NULL
        """,
        (scope_id,),
    )
    predictions = list(cur.fetchall())

    # Pool membership from the latest Task 4 dormant snapshot. Indexed by
    # (prediction_date, source_row_index). See `_load_dormant_set` for the
    # three-concept separation rationale.
    dormant_set = _load_dormant_set()

    # Metric lookups
    theme_metrics: dict[tuple[str, str], dict] = {}
    category_metrics: dict[tuple[str, str], dict] = {}
    prediction_metrics: dict[tuple[str, str], dict] = {}
    theme_grass: dict[tuple[str, str], list[dict]] = {}
    category_grass: dict[tuple[str, str], list[dict]] = {}
    prediction_grass: dict[tuple[str, str], list[dict]] = {}

    # Compute window date ranges up front so the grass_daily queries can
    # reuse them.
    windows_ranges: dict[str, tuple[str, str]] = {}
    if latest_d is not None:
        for wid, days in WINDOWS:
            s, e = window_range(latest_d, days)
            windows_ranges[wid] = (s.isoformat(), e.isoformat())

    if latest:
        theme_metrics = _theme_metric_lookup(conn, scope_id, latest)
        category_metrics = _category_metric_lookup(conn, scope_id, latest)
        prediction_metrics = _prediction_metric_lookup(conn, scope_id)
        theme_grass = _theme_grass_daily(conn, scope_id, windows_ranges)
        category_grass = _category_grass_daily(conn, scope_id, windows_ranges)
        prediction_grass = _prediction_grass_daily(conn, scope_id, windows_ranges)

    # Readings — Step 1: cluster index. Group evidence by
    # (theme_id, week_bucket) so the prediction loop can compute
    # cluster density (how many similar observations support P) and
    # frequency trend (whether the cluster is accelerating). Built
    # once per scope export to avoid N+1 queries inside the loop.
    evidence_to_cluster, cluster_to_evidence = _build_evidence_cluster_index(
        conn, scope_id
    )
    theme_label_lookup = {th["theme_id"]: th for th in themes}

    # Phase 3: cluster → [predictions citing it] index. For each
    # cluster, list the predictions whose evidence overlaps with it
    # (companion predictions). Lets the Readings tab show "this
    # cluster is also cited by predictions X (lands by Q3 2026), Y
    # (lands by Q4 2026)..." with each companion's target window.
    cluster_to_predictions: dict[str, list[dict]] = {}
    cur = conn.execute(
        """
        SELECT pel.evidence_id, pel.prediction_id,
               p.prediction_short_label AS short_label,
               p.title AS title,
               p.prediction_date AS pred_date,
               p.target_start_date AS target_start,
               p.target_end_date AS target_end
        FROM prediction_evidence_links pel
        JOIN predictions p ON pel.prediction_id = p.prediction_id
        WHERE pel.scope_id = ?
        """,
        (scope_id,),
    )
    for row in cur.fetchall():
        ck = evidence_to_cluster.get(row["evidence_id"])
        if not ck:
            continue
        bucket = cluster_to_predictions.setdefault(ck, [])
        # de-dupe: one prediction can cite multiple evidence rows in
        # the same cluster, but we list it only once per cluster.
        if any(p["prediction_id"] == row["prediction_id"] for p in bucket):
            continue
        bucket.append({
            "prediction_id": row["prediction_id"],
            "title": row["title"],
            "short_label": row["short_label"],
            "pred_date": row["pred_date"],
            "target_start_date": row["target_start"],
            "target_end_date": row["target_end"],
        })

    # Readings — Step 4: P↔P relations index. Captures structural
    # relationships between predictions (parallel / exclusive_variant
    # / negation / entails / equivalent), independent of any
    # evidence-mediated linkage. Built once per export so the
    # prediction loop is just a dict lookup.
    relations_cur = conn.execute(
        """
        SELECT pr.relation_id, pr.prediction_a, pr.prediction_b,
               pr.relation_type, pr.family_id, pr.prob_mass, pr.notes,
               pb.prediction_short_label AS b_label,
               pb.title AS b_title,
               pb.prediction_date AS b_pred_date,
               pb.target_start_date AS b_target_start,
               pb.target_end_date AS b_target_end
        FROM prediction_relations pr
        JOIN predictions pb ON pr.prediction_b = pb.prediction_id
        ORDER BY pr.prediction_a, pr.relation_type
        """
    )
    relations_index: dict[str, list[dict]] = {}
    for row in relations_cur.fetchall():
        relations_index.setdefault(row["prediction_a"], []).append({
            "relation_id": row["relation_id"],
            "other_prediction_id": row["prediction_b"],
            "other_title": row["b_title"],
            "other_short_label": row["b_label"],
            "relation_type": row["relation_type"],
            "family_id": row["family_id"],
            "prob_mass": row["prob_mass"],
            "notes": row["notes"],
            # Phase 3: other prediction's date + target window
            "other_pred_date": row["b_pred_date"],
            "other_target_start_date": row["b_target_start"],
            "other_target_end_date": row["b_target_end"],
        })

    # Readings — Step 2: chain index. For each prediction, look up:
    #   - downstream: predictions strengthened if THIS one lands
    #   - upstream:   predictions whose landing would strengthen THIS one
    # Cached once per export so the prediction loop is just a dict
    # lookup. Chain rows live in the prediction_chain table and may
    # be authored by `2_future_prediction` (manual) or by a future
    # `extract-chain-effects` skill (LLM-driven).
    #
    # Defensive guard: if the same (source, downstream) pair already
    # has a `prediction_relations.entails` row, that's the canonical
    # signal (strict logical implication, strictly stronger than the
    # probabilistic chain). Exclude such chain rows here so the
    # frontend doesn't render the same pair twice. The writer
    # contract in design/skills/extract-chain-effects.md forbids
    # creating both — this guard handles legacy / accidental
    # overlap.
    cur = conn.execute(
        """
        SELECT pc.source_prediction_id, pc.downstream_prediction_id,
               pc.via_evidence_id, pc.strength, pc.notes,
               p2.prediction_short_label AS downstream_label,
               p2.title AS downstream_title,
               p2.prediction_date AS downstream_pred_date,
               p2.target_start_date AS downstream_target_start,
               p2.target_end_date AS downstream_target_end,
               p1.prediction_short_label AS source_label,
               p1.title AS source_title,
               p1.prediction_date AS source_pred_date,
               p1.target_start_date AS source_target_start,
               p1.target_end_date AS source_target_end
        FROM prediction_chain pc
        JOIN predictions p1 ON pc.source_prediction_id = p1.prediction_id
        JOIN predictions p2 ON pc.downstream_prediction_id = p2.prediction_id
        WHERE NOT EXISTS (
            SELECT 1 FROM prediction_relations pr
            WHERE pr.prediction_a = pc.source_prediction_id
              AND pr.prediction_b = pc.downstream_prediction_id
              AND pr.relation_type = 'entails'
        )
        ORDER BY pc.strength DESC
        """
    )
    downstream_index: dict[str, list[dict]] = {}
    upstream_index: dict[str, list[dict]] = {}
    for row in cur.fetchall():
        # Phase 3: emit pred_date + target_* of the *other* end of the
        # chain so the frontend can show "lands by Q3 2026" inline
        # without an extra round-trip.
        downstream_index.setdefault(row["source_prediction_id"], []).append({
            "prediction_id": row["downstream_prediction_id"],
            "title": row["downstream_title"],
            "short_label": row["downstream_label"],
            "strength": row["strength"],
            "notes": row["notes"],
            "via_evidence_id": row["via_evidence_id"],
            "pred_date": row["downstream_pred_date"],
            "target_start_date": row["downstream_target_start"],
            "target_end_date": row["downstream_target_end"],
        })
        upstream_index.setdefault(row["downstream_prediction_id"], []).append({
            "prediction_id": row["source_prediction_id"],
            "title": row["source_title"],
            "short_label": row["source_label"],
            "strength": row["strength"],
            "notes": row["notes"],
            "via_evidence_id": row["via_evidence_id"],
            "pred_date": row["source_pred_date"],
            "target_start_date": row["source_target_start"],
            "target_end_date": row["source_target_end"],
        })

    layouts = _load_layout_map(conn, scope_id)

    # ------------------------------------------------------------------
    # Build nodes
    # ------------------------------------------------------------------
    nodes: list[dict] = []
    id_index: dict[str, dict] = {}

    # Deterministic default layout: categories on a large ring; themes on
    # smaller ring around their category; predictions on small ring
    # around parent theme/subtheme.
    cat_coords = _ring_layout(len(categories), radius=600.0)
    cat_to_coord: dict[str, tuple[float, float]] = {}
    for (cat, coord) in zip(categories, cat_coords):
        cat_to_coord[cat["category_id"]] = coord

    def build_metrics(kind: str, ident: str) -> dict:
        out = {}
        for window_id, _days in WINDOWS:
            if kind == "theme":
                bundle = dict(theme_metrics.get((ident, window_id), _blank_metric_bundle("theme")))
                bundle["grass_daily"] = list(theme_grass.get((ident, window_id), []))
            elif kind == "category":
                bundle = dict(category_metrics.get((ident, window_id), _blank_metric_bundle("category")))
                bundle["grass_daily"] = list(category_grass.get((ident, window_id), []))
            elif kind == "prediction":
                # Per-window metrics are computed honestly from the evidence
                # in the window. Whether a prediction's origin date falls
                # inside the window's lookback range is a *display-side*
                # concern (frontend filters by detail.prediction_date) —
                # do NOT smuggle that gate into the metrics bundle. Three
                # orthogonal concepts, all separately observable:
                #   - Hot / Lukewarm: relevance signal across recent
                #     validations (encoded by attention_score / status).
                #   - Window filter: which predictions are visible in 7d
                #     vs 30d vs 90d — applied client-side from prediction_date.
                #   - Dormant: the prediction is parked in the dormant
                #     pool (Task 4); surfaced as detail.dormant on the node.
                bundle = dict(prediction_metrics.get((ident, window_id), _blank_metric_bundle("prediction")))
                bundle["grass_daily"] = list(prediction_grass.get((ident, window_id), []))
            else:
                bundle = dict(_blank_metric_bundle(kind))
                bundle["grass_daily"] = []
            out[window_id] = bundle
        return out

    for cat, coord in zip(categories, cat_coords):
        node_id = cat["category_id"]
        layout = layouts.get(node_id) or {
            "x": coord[0],
            "y": coord[1],
            "z": 0.0,
            "radius": 28.0,
            "fixed": False,
        }
        cat_labels = _locale_field(cat, "label")
        cat_short_labels = _locale_field(cat, "short_label")
        # short_label.en falls back to label.en when the seed left it NULL.
        if not cat_short_labels["en"]:
            for kk in ("en", "ja", "es", "fil"):
                if not cat_short_labels[kk]:
                    cat_short_labels[kk] = cat_labels[kk]
        cat_descriptions = _locale_field(cat, "description")
        node = {
            "id": node_id,
            "type": "category",
            "scope_id": scope_id,
            "label": cat["label"],
            "short_label": cat["short_label"] or cat["label"],
            "description": cat["description"],
            "labels": {
                "label": cat_labels,
                "short_label": cat_short_labels,
                "description": cat_descriptions,
            },
            "category_id": cat["category_id"],
            "theme_id": None,
            "subtheme_id": None,
            "prediction_id": None,
            "parent_ids": [],
            "child_ids": [],
            "metrics_by_window": build_metrics("category", node_id),
            "visibility": {
                # Categories are the broad-bucket overview — always visible.
                "min_zoom": 0.0,
                "max_zoom": None,
                "default_visible": True,
            },
            "layout": layout,
            "detail": {
                "title": cat["label"],
                "subtitle": f"Category · {scope_id.title()}",
                "description": cat["description"],
                "scope_id": scope_id,
                "node_type": "category",
            },
        }
        nodes.append(node)
        id_index[node_id] = node

    # Themes: cluster around their category
    themes_by_cat: dict[str, list[sqlite3.Row]] = {}
    for th in themes:
        themes_by_cat.setdefault(th["category_id"], []).append(th)
    for cat_id, group in themes_by_cat.items():
        center = cat_to_coord.get(cat_id, (0.0, 0.0))
        ring = _ring_layout(len(group), radius=180.0)
        for th, (dx, dy) in zip(group, ring):
            node_id = th["theme_id"]
            layout = layouts.get(node_id) or {
                "x": center[0] + dx,
                "y": center[1] + dy,
                "z": 0.0,
                "radius": 24.0,
                "fixed": False,
            }
            # Build per-field locale dicts. Theme canonical column is
            # 'canonical_label', not 'label'; locale cols are label_ja etc.,
            # with EN fallback per-field for missing translations.
            th_label_en = th["canonical_label"]
            th_labels = {
                "en": th_label_en,
                "ja": th["label_ja"] if th["label_ja"] else th_label_en,
                "es": th["label_es"] if th["label_es"] else th_label_en,
                "fil": th["label_fil"] if th["label_fil"] else th_label_en,
            }
            th_short_en = th["short_label"] or th_label_en
            th_short_labels = {
                "en": th_short_en,
                "ja": th["short_label_ja"] if th["short_label_ja"] else th_short_en,
                "es": th["short_label_es"] if th["short_label_es"] else th_short_en,
                "fil": th["short_label_fil"] if th["short_label_fil"] else th_short_en,
            }
            th_desc_en = th["description"]
            th_descriptions = {
                "en": th_desc_en,
                "ja": th["description_ja"] if th["description_ja"] else th_desc_en,
                "es": th["description_es"] if th["description_es"] else th_desc_en,
                "fil": th["description_fil"] if th["description_fil"] else th_desc_en,
            }
            node = {
                "id": node_id,
                "type": "theme",
                "scope_id": scope_id,
                "label": th["canonical_label"],
                "short_label": th["short_label"] or th["canonical_label"],
                "description": th["description"],
                "labels": {
                    "label": th_labels,
                    "short_label": th_short_labels,
                    "description": th_descriptions,
                },
                "category_id": th["category_id"],
                "theme_id": th["theme_id"],
                "subtheme_id": None,
                "prediction_id": None,
                "parent_ids": [th["category_id"]],
                "child_ids": [],
                "metrics_by_window": build_metrics("theme", node_id),
                "visibility": {
                    # Themes appear when the user drills past the
                    # category-level overview.
                    "min_zoom": 0.75,
                    "max_zoom": None,
                    "default_visible": False,
                },
                "layout": layout,
                "detail": {
                    "title": th["canonical_label"],
                    "subtitle": f"Theme · {scope_id.title()}",
                    "description": th["description"],
                    "scope_id": scope_id,
                    "node_type": "theme",
                    "parent_category_id": th["category_id"],
                },
            }
            nodes.append(node)
            id_index[node_id] = node
            # Link: category contains theme
            parent = id_index.get(th["category_id"])
            if parent is not None:
                parent["child_ids"].append(node_id)

    # Subthemes
    for st in subthemes:
        theme_node = id_index.get(st["theme_id"])
        if theme_node is None:
            continue
        base_x = theme_node["layout"]["x"]
        base_y = theme_node["layout"]["y"]
        node_id = st["subtheme_id"]
        layout = layouts.get(node_id) or {
            "x": base_x + 60.0,
            "y": base_y + 40.0,
            "z": 0.0,
            "radius": 16.0,
            "fixed": False,
        }
        st_label_en = st["canonical_label"]
        st_labels = {
            "en": st_label_en,
            "ja": st["label_ja"] if st["label_ja"] else st_label_en,
            "es": st["label_es"] if st["label_es"] else st_label_en,
            "fil": st["label_fil"] if st["label_fil"] else st_label_en,
        }
        st_short_en = st["short_label"] or st_label_en
        st_short_labels = {
            "en": st_short_en,
            "ja": st["short_label_ja"] if st["short_label_ja"] else st_short_en,
            "es": st["short_label_es"] if st["short_label_es"] else st_short_en,
            "fil": st["short_label_fil"] if st["short_label_fil"] else st_short_en,
        }
        st_desc_en = st["description"]
        st_descriptions = {
            "en": st_desc_en,
            "ja": st["description_ja"] if st["description_ja"] else st_desc_en,
            "es": st["description_es"] if st["description_es"] else st_desc_en,
            "fil": st["description_fil"] if st["description_fil"] else st_desc_en,
        }
        node = {
            "id": node_id,
            "type": "subtheme",
            "scope_id": scope_id,
            "label": st["canonical_label"],
            "short_label": st["short_label"] or st["canonical_label"],
            "description": st["description"],
            "labels": {
                "label": st_labels,
                "short_label": st_short_labels,
                "description": st_descriptions,
            },
            "category_id": st["category_id"],
            "theme_id": st["theme_id"],
            "subtheme_id": st["subtheme_id"],
            "prediction_id": None,
            "parent_ids": [st["theme_id"]],
            "child_ids": [],
            "metrics_by_window": {w: _blank_metric_bundle("subtheme") for w, _ in WINDOWS},
            "visibility": {
                "min_zoom": 1.25,
                "max_zoom": None,
                "default_visible": False,
            },
            "layout": layout,
            "detail": {
                "title": st["canonical_label"],
                "subtitle": f"Subtheme · {scope_id.title()}",
                "description": st["description"],
                "scope_id": scope_id,
                "node_type": "subtheme",
                "parent_theme_id": st["theme_id"],
                "parent_category_id": st["category_id"],
            },
        }
        nodes.append(node)
        id_index[node_id] = node
        theme_node["child_ids"].append(node_id)

    # Predictions
    pred_by_parent: dict[str, list[sqlite3.Row]] = {}
    for pr in predictions:
        parent_id = pr["subtheme_id"] or pr["theme_id"]
        if not parent_id:
            continue
        pred_by_parent.setdefault(parent_id, []).append(pr)
    for parent_id, group in pred_by_parent.items():
        parent_node = id_index.get(parent_id)
        if parent_node is None:
            continue
        base_x = parent_node["layout"]["x"]
        base_y = parent_node["layout"]["y"]
        ring = _ring_layout(len(group), radius=55.0)
        for pr, (dx, dy) in zip(group, ring):
            node_id = pr["prediction_id"]
            layout = layouts.get(node_id) or {
                "x": base_x + dx,
                "y": base_y + dy,
                "z": 0.0,
                "radius": 9.0,
                "fixed": False,
            }
            summary = pr["prediction_summary"] or ""
            # Fallback through the parser's clause-split logic (no length
            # cap) when the row has no short_label yet — keeps every byte
            # of meaning so UI ellipsis stays a CSS concern, not a
            # data-loss one.
            short_label = pr["prediction_short_label"] or _derive_short_label(summary, _bold_hint(summary), 0)
            # `label` used to be a 140-char truncated copy of summary.
            # We collapse it onto short_label so the field is just an
            # alias for "the concise display name" — full text lives in
            # `description` / `prediction_summary` already.
            label = short_label

            # Evidence pull
            cur = conn.execute(
                """
                SELECT pel.evidence_id, pel.validation_date, pel.support_direction,
                       pel.relatedness_score, pel.evidence_strength, pel.contradiction_score,
                       pel.evidence_recency_type,
                       ev.url, ev.title, ev.source_name, ev.source_type
                FROM prediction_evidence_links pel
                JOIN evidence_items ev ON pel.evidence_id = ev.evidence_id
                WHERE pel.prediction_id = ? AND pel.scope_id = ?
                ORDER BY pel.validation_date DESC
                """,
                (pr["prediction_id"], scope_id),
            )
            evidence = [
                {
                    "evidence_id": r["evidence_id"],
                    "title": r["title"],
                    "url": r["url"],
                    "source_name": r["source_name"],
                    "source_type": r["source_type"],
                    "support_direction": r["support_direction"],
                    "relatedness_score": r["relatedness_score"],
                    "evidence_strength": r["evidence_strength"],
                    "validation_date": r["validation_date"],
                    "evidence_recency_type": r["evidence_recency_type"],
                }
                for r in cur.fetchall()
            ]

            # All validation-report paths that cite this prediction,
            # newest first. Frontend filters by window and shows count
            # + top 3. ``validation_report_path`` kept populated with
            # the single newest path for backwards compatibility.
            # bridge: also pulls bridge_text + support_dimension so
            # the dashboard's Bridge tab can render the narrative
            # paragraph from the most recent validation row.
            cur = conn.execute(
                """
                SELECT vr.validation_date AS d, sf.path AS path,
                       vr.bridge_text, vr.bridge_text_ja, vr.bridge_text_es, vr.bridge_text_fil,
                       vr.support_dimension,
                       vr.bridge_target_start_date, vr.bridge_target_end_date
                FROM validation_rows vr
                JOIN source_files sf ON vr.source_file_id = sf.source_file_id
                WHERE vr.prediction_id = ?
                ORDER BY vr.validation_date DESC
                """,
                (pr["prediction_id"],),
            )
            validation_reports_rows = cur.fetchall()
            validation_reports = [
                {"date": r["d"], "path": r["path"]} for r in validation_reports_rows
            ]
            # bridge: collect non-empty bridge paragraphs, newest first.
            # Phase 3: bridges carry their own target_start/end dates
            # extracted from "Remaining gap: <time>" mentions.
            bridges = [
                {
                    "date": r["d"],
                    "text": r["bridge_text"],
                    "text_locales": _loc(
                        r["bridge_text"],
                        r["bridge_text_ja"],
                        r["bridge_text_es"],
                        r["bridge_text_fil"],
                    ),
                    "dimension": r["support_dimension"],
                    "target_start_date": r["bridge_target_start_date"],
                    "target_end_date": r["bridge_target_end_date"],
                }
                for r in validation_reports_rows
                if r["bridge_text"]
            ]
            validation_path = validation_reports[0]["path"] if validation_reports else None

            # Readings — Step 1: per-prediction cluster summary.
            # For each cluster the prediction's evidence touches:
            # density (count_in_pool + cluster_total + share) +
            # frequency trend (accelerating / flat / decelerating
            # based on the recent 4-week arrival pattern).
            pool_cluster_counts: dict[str, int] = {}
            for ev in evidence:
                ck = evidence_to_cluster.get(ev["evidence_id"])
                if ck:
                    pool_cluster_counts[ck] = pool_cluster_counts.get(ck, 0) + 1
            cluster_summaries: list[dict] = []
            for ck, count_in_pool in sorted(
                pool_cluster_counts.items(), key=lambda x: -x[1]
            )[:5]:
                theme_id, week_bucket = ck.split("|", 1)
                cluster_evs = cluster_to_evidence.get(ck, [])
                cluster_total = len(cluster_evs)
                th = theme_label_lookup.get(theme_id)
                theme_label = (
                    th["canonical_label"]
                    if th and th["canonical_label"]
                    else theme_id
                )
                trend = _compute_cluster_trend(cluster_evs, latest)
                # Phase 3: convert week_bucket → ISO date pair.
                week_start, week_end = parse_week_bucket(week_bucket)
                # Phase 3: companion predictions for this cluster
                # (other predictions citing the same cluster, with
                # their target windows). Excludes self.
                companions = [
                    p for p in cluster_to_predictions.get(ck, [])
                    if p["prediction_id"] != pr["prediction_id"]
                ]
                cluster_summaries.append({
                    "theme_id": theme_id,
                    "theme_label": theme_label,
                    "week_bucket": week_bucket,
                    "target_start_date": week_start,
                    "target_end_date": week_end,
                    "size_in_pool": count_in_pool,
                    "cluster_total": cluster_total,
                    "share": (
                        round(count_in_pool / cluster_total, 2)
                        if cluster_total else 0
                    ),
                    "trend": trend,
                    "companion_predictions": companions[:10],
                })

            # Readings — Step 4: P↔P relations.
            # Group this prediction's relations by relation_type and
            # build a narrative naming the most analytically loaded
            # ones first (negation > exclusive_variant > equivalent
            # > entails > parallel — i.e., the relations most likely
            # to surface a forecast-portfolio problem rank highest).
            relations_for_p = relations_index.get(pr["prediction_id"], [])
            grouped_relations: dict[str, list[dict]] = {}
            for rel in relations_for_p:
                grouped_relations.setdefault(rel["relation_type"], []).append(rel)
            relation_narratives: list[str] = []
            if "negation" in grouped_relations:
                negs = grouped_relations["negation"]
                relation_narratives.append(
                    f"⚠ Negation pair: this prediction has "
                    f"{len(negs)} explicit counter-prediction"
                    f"{'s' if len(negs) > 1 else ''} in the system. "
                    f"Treating both as independent forecasts inflates "
                    f"the apparent hit rate — only one can land."
                )
            if "exclusive_variant" in grouped_relations:
                ev = grouped_relations["exclusive_variant"]
                fams = sorted({r["family_id"] for r in ev if r["family_id"]})
                relation_narratives.append(
                    f"This prediction is one of "
                    f"{len(ev) + 1} variants in exclusive family "
                    f"'{fams[0] if fams else '?'}'. The family shares "
                    f"a single outcome space — only one variant lands."
                )
            if "equivalent" in grouped_relations:
                eqs = grouped_relations["equivalent"]
                relation_narratives.append(
                    f"Equivalent to {len(eqs)} other prediction"
                    f"{'s' if len(eqs) > 1 else ''} in the system "
                    f"(same content, different wording) — candidate "
                    f"for merge to avoid double-counting."
                )
            if "entails" in grouped_relations:
                ent = grouped_relations["entails"]
                relation_narratives.append(
                    f"Entails {len(ent)} downstream prediction"
                    f"{'s' if len(ent) > 1 else ''} (logical "
                    f"implication, not evidence-mediated) — if this "
                    f"lands, those follow by definition."
                )
            if "parallel" in grouped_relations and not relation_narratives:
                par = grouped_relations["parallel"]
                relation_narratives.append(
                    f"Parallel to {len(par)} other prediction"
                    f"{'s' if len(par) > 1 else ''} — independent "
                    f"facets, both can be true at once."
                )
            relation_narrative = " ".join(relation_narratives)

            # Readings — Step 2: chain (downstream + upstream).
            # downstream = predictions strengthened if THIS lands;
            # upstream = predictions whose landing would strengthen THIS.
            downstream_chain = downstream_index.get(pr["prediction_id"], [])
            upstream_chain = upstream_index.get(pr["prediction_id"], [])
            if downstream_chain:
                if len(downstream_chain) == 1:
                    chain_narrative = (
                        f"If this prediction lands, "
                        f"{len(downstream_chain)} downstream prediction "
                        f"gets strengthened (chain effect)."
                    )
                else:
                    chain_narrative = (
                        f"If this prediction lands, "
                        f"{len(downstream_chain)} downstream predictions "
                        f"get strengthened (chain effect)."
                    )
            elif upstream_chain:
                chain_narrative = (
                    f"This prediction is itself a downstream of "
                    f"{len(upstream_chain)} other prediction"
                    f"{'s' if len(upstream_chain) > 1 else ''} — its "
                    f"support pool grows as the upstream lands."
                )
            else:
                chain_narrative = ""

            if not cluster_summaries:
                cluster_narrative = (
                    "No cluster pattern detected — evidence either "
                    "has no theme assignment yet or arrived without a "
                    "first-seen date anchor."
                )
            elif len(cluster_summaries) == 1:
                cs = cluster_summaries[0]
                trend_phrase = {
                    "accelerating": "the cluster is accelerating",
                    "decelerating": "the cluster is fading",
                    "flat": "the cluster is steady",
                }[cs["trend"]]
                cluster_narrative = (
                    f"This prediction is supported by a single cluster: "
                    f"{cs['size_in_pool']} of {cs['cluster_total']} items "
                    f"in '{cs['theme_label']}' ({cs['week_bucket']}); "
                    f"{trend_phrase}. Concentrated support — if this "
                    f"thread breaks, the prediction loses its base."
                )
            else:
                largest = cluster_summaries[0]
                trend_phrase = {
                    "accelerating": "accelerating",
                    "decelerating": "fading",
                    "flat": "steady",
                }[largest["trend"]]
                cluster_narrative = (
                    f"Broad support across {len(cluster_summaries)} "
                    f"clusters. Largest is '{largest['theme_label']}' "
                    f"({largest['size_in_pool']} of "
                    f"{largest['cluster_total']} items, {trend_phrase}). "
                    f"Multi-thread support is more robust than "
                    f"single-cluster concentration."
                )

            # needs stream: Needs + 5W1H. One prediction can carry multiple
            # Needs (one per role-abstract actor driving the prediction
            # toward landing). Each Need carries one 5W1H task row. The
            # dashboard's Needs tab renders the actor / job / outcome /
            # motivation header + the 5W1H grid.
            cur = conn.execute(
                """
                SELECT n.need_id, n.actor, n.actor_ja, n.actor_es, n.actor_fil,
                       n.job, n.job_ja, n.job_es, n.job_fil,
                       n.outcome, n.outcome_ja, n.outcome_es, n.outcome_fil,
                       n.motivation, n.motivation_ja, n.motivation_es, n.motivation_fil,
                       n.reviewed_by_human,
                       n.target_start_date AS need_start, n.target_end_date AS need_end,
                       t.task_id,
                       t.who_text, t.who_text_ja, t.who_text_es, t.who_text_fil,
                       t.what_text, t.what_text_ja, t.what_text_es, t.what_text_fil,
                       t.where_text, t.where_text_ja, t.where_text_es, t.where_text_fil,
                       t.when_text, t.when_text_ja, t.when_text_es, t.when_text_fil,
                       t.why_text, t.why_text_ja, t.why_text_es, t.why_text_fil,
                       t.how_text, t.how_text_ja, t.how_text_es, t.how_text_fil,
                       t.status,
                       t.target_start_date AS task_start, t.target_end_date AS task_end
                FROM prediction_needs n
                LEFT JOIN needs_tasks t ON n.need_id = t.need_id
                WHERE n.prediction_id = ?
                ORDER BY n.actor
                """,
                (pr["prediction_id"],),
            )
            needs = []
            for r in cur.fetchall():
                task = None
                if r["task_id"]:
                    task = {
                        "task_id": r["task_id"],
                        "who": r["who_text"],
                        "what": r["what_text"],
                        "where": r["where_text"],
                        "when": r["when_text"],
                        "why": r["why_text"],
                        "how": r["how_text"],
                        "who_locales":   _loc(r["who_text"],   r["who_text_ja"],   r["who_text_es"],   r["who_text_fil"]),
                        "what_locales":  _loc(r["what_text"],  r["what_text_ja"],  r["what_text_es"],  r["what_text_fil"]),
                        "where_locales": _loc(r["where_text"], r["where_text_ja"], r["where_text_es"], r["where_text_fil"]),
                        "when_locales":  _loc(r["when_text"],  r["when_text_ja"],  r["when_text_es"],  r["when_text_fil"]),
                        "why_locales":   _loc(r["why_text"],   r["why_text_ja"],   r["why_text_es"],   r["why_text_fil"]),
                        "how_locales":   _loc(r["how_text"],   r["how_text_ja"],   r["how_text_es"],   r["how_text_fil"]),
                        "status": r["status"],
                        "target_start_date": r["task_start"],
                        "target_end_date":   r["task_end"],
                    }
                needs.append({
                    "need_id": r["need_id"],
                    "actor": r["actor"],
                    "job": r["job"],
                    "outcome": r["outcome"],
                    "motivation": r["motivation"],
                    "actor_locales":      _loc(r["actor"],      r["actor_ja"],      r["actor_es"],      r["actor_fil"]),
                    "job_locales":        _loc(r["job"],        r["job_ja"],        r["job_es"],        r["job_fil"]),
                    "outcome_locales":    _loc(r["outcome"],    r["outcome_ja"],    r["outcome_es"],    r["outcome_fil"]),
                    "motivation_locales": _loc(r["motivation"], r["motivation_ja"], r["motivation_es"], r["motivation_fil"]),
                    "reviewed_by_human": bool(r["reviewed_by_human"]),
                    "target_start_date": r["need_start"],
                    "target_end_date":   r["need_end"],
                    "task": task,
                })

            # Primary parent from scope_assignment, plus IDF-matched
            # secondary themes (1:N). Duplicates removed.
            parents = [parent_id]
            for extra_th in extra_theme_parents(summary, pr["theme_id"]):
                if extra_th not in parents:
                    parents.append(extra_th)
            # Per-locale labels for prediction nodes. The summary
            # column is canonical EN; *_ja/_es/_fil locales fall back
            # to EN per-field. The truncated `label` and the
            # `short_label` mirror the same locale fan-out by reusing
            # the prediction_short_label_<locale> column when present
            # and falling back to the EN truncation otherwise.
            sum_ja = pr["prediction_summary_ja"]
            sum_es = pr["prediction_summary_es"]
            sum_fil = pr["prediction_summary_fil"]
            sl_ja = pr["prediction_short_label_ja"]
            sl_es = pr["prediction_short_label_es"]
            sl_fil = pr["prediction_short_label_fil"]

            def _short_for_locale(direct, local_summary):
                """Resolve a per-locale short label without truncating.
                Prefer the explicit DB column; fall back to deriving from
                the locale's summary; finally return None so the caller
                can chain to the EN short_label."""
                if direct:
                    return direct
                if local_summary:
                    return _derive_short_label(local_summary, _bold_hint(local_summary), 0)
                return None

            short_label_locales = {
                "en":  short_label,
                "ja":  _short_for_locale(sl_ja,  sum_ja)  or short_label,
                "es":  _short_for_locale(sl_es,  sum_es)  or short_label,
                "fil": _short_for_locale(sl_fil, sum_fil) or short_label,
            }
            # `label_locales` is just an alias for short_label_locales.
            # The 140-char truncation that used to live here was lossy;
            # full text now lives in description / summary_locales.
            label_locales = dict(short_label_locales)
            summary_locales = {
                "en":  summary,
                "ja":  sum_ja  if sum_ja  else summary,
                "es":  sum_es  if sum_es  else summary,
                "fil": sum_fil if sum_fil else summary,
            }
            # title field: dedicated `title` (≤ 80 chars, no markdown, no
            # scope prefix). When NULL on disk we leave it out — the
            # frontend `cleanPredictionTitle` helper derives a clean
            # title from `summary` as a fallback. The locale fan-out is
            # title-only; we don't translate the title because the
            # writer emits it in EN canonical and the dashboard renders
            # the same title across all 4 locales.
            # Phase 4a: title field title is now locale-translated (the writer
            # emits a JA/ES/FIL title line in each sibling news file). The
            # frontend's `nodeLabel(n, "title")` picks the right locale via
            # `node.labels.title[state.locale]`.
            prediction_title = pr["prediction_title"]
            title_locales = _loc(
                prediction_title,
                pr["title_ja"],
                pr["title_es"],
                pr["title_fil"],
            )
            node = {
                "id": node_id,
                "type": "prediction",
                "scope_id": scope_id,
                "label": label,
                "short_label": short_label,
                "title": prediction_title,
                "description": summary,
                "labels": {
                    "label": label_locales,
                    "short_label": short_label_locales,
                    "title": title_locales,
                    "description": summary_locales,
                    "summary": summary_locales,
                },
                "category_id": pr["category_id"],
                "theme_id": pr["theme_id"],
                "subtheme_id": pr["subtheme_id"],
                "prediction_id": pr["prediction_id"],
                "parent_ids": parents,
                "child_ids": [],
                "metrics_by_window": build_metrics("prediction", node_id),
                "visibility": {
                    "min_zoom": 2.0,
                    "max_zoom": None,
                    "default_visible": False,
                },
                "layout": layout,
                "detail": {
                    "title": short_label,
                    # title field: cleaned, dedicated title (NULL until the
                    # writer fills it in for this prediction). The
                    # frontend prefers this over the legacy `title` and
                    # over the markdown-heavy `prediction_summary`.
                    "title_clean": prediction_title,
                    # reasoning fields: structured reasoning trace. The frontend
                    # Reasoning tab renders the four `because/given/so_that/
                    # landing` fields plus the `eli14` plain-language line.
                    # All five fields are nullable; the tab hides empty rows.
                    "reasoning": {
                        "because":  pr["reasoning_because"],
                        "given":    pr["reasoning_given"],
                        "so_that":  pr["reasoning_so_that"],
                        "landing":  pr["reasoning_landing"],
                        "eli14":    pr["eli14"],
                    },
                    "reasoning_locales": {
                        "because": _loc(pr["reasoning_because"], pr["reasoning_because_ja"], pr["reasoning_because_es"], pr["reasoning_because_fil"]),
                        "given":   _loc(pr["reasoning_given"],   pr["reasoning_given_ja"],   pr["reasoning_given_es"],   pr["reasoning_given_fil"]),
                        "so_that": _loc(pr["reasoning_so_that"], pr["reasoning_so_that_ja"], pr["reasoning_so_that_es"], pr["reasoning_so_that_fil"]),
                        "landing": _loc(pr["reasoning_landing"], pr["reasoning_landing_ja"], pr["reasoning_landing_es"], pr["reasoning_landing_fil"]),
                        "eli14":   _loc(pr["eli14"],             pr["eli14_ja"],             pr["eli14_es"],             pr["eli14_fil"]),
                    },
                    "title_locales": _loc(pr["prediction_title"], pr["title_ja"], pr["title_es"], pr["title_fil"]),
                    # mid-tier summary: mid-tier summary + locale fan-out.
                    # The dashboard right pane is now 3-tier:
                    #   1. title (large)
                    #   2. summary (this — default visible, ≤ 300 chars)
                    #   3. full text (collapsed in <details> below)
                    # Per-locale NULLs fall back to EN here so the
                    # frontend can index `detail.summary_locales[loc]`
                    # without guarding.
                    "summary_short": pr["pred_summary"],
                    "summary_short_locales": {
                        "en":  pr["pred_summary"],
                        "ja":  pr["pred_summary_ja"]  or pr["pred_summary"],
                        "es":  pr["pred_summary_es"]  or pr["pred_summary"],
                        "fil": pr["pred_summary_fil"] or pr["pred_summary"],
                    },
                    # bridge: validation-time bridge paragraphs that
                    # explain how today's SUPPORT signals back into the
                    # prediction's reasoning trace. Newest first; empty
                    # list when no validation row has bridge_text yet.
                    "bridges": bridges,
                    # needs stream: Needs + 5W1H. One entry per actor whose
                    # work drives the prediction toward landing. Each
                    # entry has actor / job / outcome / motivation + a
                    # single 5W1H task row. Empty list until
                    # extract-needs has been run on this prediction.
                    "needs": needs,
                    # Readings — Step 1: cluster density + trend.
                    # Each cluster entry has theme_label, week_bucket,
                    # size_in_pool (P's count), cluster_total (cluster's
                    # total count across all predictions), share, and
                    # trend (accelerating / flat / decelerating). The
                    # narrative is a one-line human summary the
                    # frontend renders before any numbers.
                    "readings": {
                        "clusters": cluster_summaries,
                        "cluster_narrative": cluster_narrative,
                        # Readings — Step 2: chain effects.
                        # downstream: this prediction's landing
                        # strengthens these others. upstream: these
                        # other predictions' landings would
                        # strengthen this one.
                        "downstream": downstream_chain,
                        "upstream": upstream_chain,
                        "chain_narrative": chain_narrative,
                        # Readings — Step 4: P↔P relations.
                        # Structural relationships between predictions
                        # (parallel / exclusive_variant / negation /
                        # entails / equivalent), independent of
                        # evidence-mediated chains. Surfaces forecast
                        # portfolio problems: hit-rate inflation
                        # (negation pairs), prediction duplication
                        # (equivalent), variant family probability
                        # mass (exclusive_variant).
                        "relations": relations_for_p,
                        "relation_narrative": relation_narrative,
                    },
                    "subtitle": f"Prediction · {scope_id.title()}",
                    "description": summary,
                    "scope_id": scope_id,
                    "node_type": "prediction",
                    "prediction_summary": summary,
                    "prediction_summary_locales": summary_locales,
                    "prediction_date": pr["prediction_date"],
                    "source_report_path": pr["source_path"],
                    "validation_report_path": validation_path,
                    "validation_reports": validation_reports,
                    "parent_category_id": pr["category_id"],
                    "parent_theme_id": pr["theme_id"],
                    "parent_subtheme_id": pr["subtheme_id"],
                    "latest_observed_relevance": pr["latest_observed_relevance"],
                    "latest_realization_score": pr["latest_realization_score"],
                    "latest_contradiction_score": pr["latest_contradiction_score"],
                    "latest_observation_status": pr["latest_observation_status"],
                    "huge_longshot_hit_at": pr["huge_longshot_hit_at"],
                    # Phase 3: structured target window (the
                    # prediction's destination — when it completes).
                    # Derived from `reasoning_landing` by the
                    # timewindow parser. NULL when the writer's
                    # landing text can't be parsed.
                    "target_start_date": pr["target_start_date"],
                    "target_end_date": pr["target_end_date"],
                    # Dormant pool membership (Task 4 snapshot). True iff
                    # this prediction's (date, source_row_index) appears in
                    # the latest `memory/dormant/dormant-*.md` table. This
                    # is window-independent — the frontend uses it to mute
                    # / badge the node across all of 7d / 30d / 90d. Window
                    # *visibility* (whether the prediction renders at all
                    # in a given window) is a separate, frontend-side
                    # concern derived from `prediction_date`.
                    "dormant": (
                        (pr["prediction_date"], pr["source_row_index"]) in dormant_set
                    ),
                    "evidence": evidence,
                },
            }
            nodes.append(node)
            id_index[node_id] = node
            parent_node["child_ids"].append(node_id)
            # Register this prediction as a child of any secondary
            # themes we attached above (keeps theme.child_ids in sync).
            for extra_th in parents[1:]:
                th_node = id_index.get(extra_th)
                if th_node is not None and node_id not in th_node["child_ids"]:
                    th_node["child_ids"].append(node_id)

    # ------------------------------------------------------------------
    # No-empty-theme rule
    #
    # For each theme that still has zero children after primary +
    # IDF-secondary assignment, force-attach the single best-fitting
    # prediction (by IDF score against this theme's keywords). This
    # guarantees every theme shown on the graph has at least one
    # prediction under it, so status/realization rollups have
    # *something* to average rather than sitting at 0 forever.
    # ------------------------------------------------------------------
    pred_nodes = [n for n in nodes if n["type"] == "prediction"]
    pred_tokens_by_id = {p["id"]: _tok(p.get("description") or p.get("label") or "") for p in pred_nodes}
    theme_nodes = [n for n in nodes if n["type"] == "theme"]
    for th_node in theme_nodes:
        if th_node["child_ids"]:
            continue
        th_tokens = (
            _tok(th_node.get("label") or "")
            | _tok(th_node.get("short_label") or "")
            | _tok(th_node.get("description") or "")
        )
        if not th_tokens:
            continue
        best_pred = None
        best_score = 0.0
        for p in pred_nodes:
            pt = pred_tokens_by_id.get(p["id"]) or set()
            shared = th_tokens & pt
            if not shared:
                continue
            score = sum(1.0 / df[t] for t in shared if df.get(t, 0) > 0)
            if score > best_score:
                best_score = score
                best_pred = p
        if best_pred is None:
            continue
        # Attach as secondary parent (keep its primary intact).
        if th_node["id"] not in best_pred["parent_ids"]:
            best_pred["parent_ids"].append(th_node["id"])
        if best_pred["id"] not in th_node["child_ids"]:
            th_node["child_ids"].append(best_pred["id"])

    # ------------------------------------------------------------------
    # Aggregate metrics from secondary children
    #
    # The DB-driven theme metrics (`_theme_grass_daily`, `theme_metrics`)
    # only see predictions whose **primary** prediction_scope_assignment
    # row points at this theme. Predictions attached to a theme via the
    # IDF-secondary rule or the no-empty-theme force-attach do NOT have
    # such a row, so the theme's grass_daily / attention / realization
    # stay at 0 even though clickable child predictions exist beneath
    # it. That made themes like Local Runtime read as "new" forever.
    #
    # Fix: after all parent/child wiring is done, walk every theme's
    # child predictions and roll up grass_daily + attention + realization
    # into the theme's bundle when the DB rollup left it empty.
    # ------------------------------------------------------------------
    def _is_empty_bundle(b):
        return (
            (b.get("attention_score") or 0) == 0
            and (b.get("realization_score") or 0) == 0
            and not b.get("grass_daily")
        )

    def _rollup_into(parent_node, child_type: str):
        """Walk parent_node.child_ids, pull metrics from children of
        ``child_type``, and overwrite the parent's bundle when the
        bundle is still empty. Used twice — first for themes (children
        are predictions), then for categories (children are themes
        already populated by the previous pass)."""
        for window_id, _days in WINDOWS:
            bundle = parent_node["metrics_by_window"].get(window_id)
            if not bundle or not _is_empty_bundle(bundle):
                continue
            date_attn: dict[str, float] = {}
            attns: list[float] = []
            reals: list[float] = []
            for cid in parent_node["child_ids"]:
                cn = id_index.get(cid)
                if cn is None or cn["type"] != child_type:
                    continue
                cm = cn["metrics_by_window"].get(window_id, {}) or {}
                a = cm.get("attention_score")
                r = cm.get("realization_score")
                if isinstance(a, (int, float)):
                    attns.append(a)
                if isinstance(r, (int, float)):
                    reals.append(r)
                for entry in cm.get("grass_daily", []) or []:
                    d = entry.get("date")
                    if not d:
                        continue
                    date_attn[d] = date_attn.get(d, 0.0) + float(entry.get("attention_score") or 0)
            if not date_attn and not attns and not reals:
                continue
            new_grass = []
            for d in sorted(date_attn):
                attn = min(1.0, date_attn[d])
                new_grass.append({
                    "date": d,
                    "grass_level": _grass_level_for(attn),
                    "attention_score": attn,
                })
            bundle["grass_daily"] = new_grass
            if attns:
                bundle["attention_score"] = max(attns)
                bundle["grass_level"] = _grass_level_for(bundle["attention_score"])
            if reals:
                bundle["realization_score"] = sum(reals) / len(reals)
            attn_now = bundle["attention_score"]
            real_now = bundle["realization_score"]
            if attn_now >= 0.5 and real_now >= 0.5:
                bundle["status"] = "active"
            elif attn_now >= 0.3:
                bundle["status"] = "continuing"
            else:
                bundle["status"] = "dormant"

    # Themes first (from their prediction children), then categories
    # (from their now-populated theme children). Order matters.
    for th_node in theme_nodes:
        _rollup_into(th_node, "theme") if False else _rollup_into(th_node, "prediction")
    category_nodes = [n for n in nodes if n["type"] == "category"]
    for cat_node in category_nodes:
        _rollup_into(cat_node, "theme")

    # ------------------------------------------------------------------
    # Build links (contains, plus cross-category shares_prediction)
    # ------------------------------------------------------------------
    links: list[dict] = []
    known_ids = set(id_index.keys())
    for node in nodes:
        for parent_id in node["parent_ids"]:
            if parent_id not in known_ids:
                continue
            link_id = f"link.{parent_id}__{node['id']}"
            links.append(
                {
                    "id": link_id,
                    "source": parent_id,
                    "target": node["id"],
                    "type": "contains",
                    "weight": 1.0,
                    "status": "active",
                }
            )

    # Cross-category "shares_prediction" links. When a prediction has
    # parent themes in two or more different categories, add a link
    # between those categories so the connection is visible even at
    # the most-zoomed-out view (themes-only).
    cross_cat_pairs: set[tuple[str, str]] = set()
    linked_categories: set[str] = set()
    for node in nodes:
        if node["type"] != "prediction":
            continue
        cats: set[str] = set()
        for pid in node["parent_ids"]:
            pn = id_index.get(pid)
            if pn is None:
                continue
            if pn["type"] == "theme" and pn.get("category_id"):
                cats.add(pn["category_id"])
            elif pn["type"] == "subtheme" and pn.get("category_id"):
                cats.add(pn["category_id"])
        if len(cats) < 2:
            continue
        ordered = sorted(cats)
        linked_categories.update(ordered)
        for i in range(len(ordered)):
            for j in range(i + 1, len(ordered)):
                cross_cat_pairs.add((ordered[i], ordered[j]))
    for (a, b) in sorted(cross_cat_pairs):
        links.append({
            "id": f"link.shares.{a}__{b}",
            "source": a,
            "target": b,
            "type": "shares_prediction",
            "weight": 0.6,
            "status": "active",
        })

    # Promote categories that participate in a shares_prediction link so
    # they stay visible at the most-zoomed-out view (the user asked for
    # these overview cross-links to always render).
    for cat_id in linked_categories:
        cn = id_index.get(cat_id)
        if cn is None:
            continue
        cn["visibility"]["min_zoom"] = 0.0
        cn["visibility"]["default_visible"] = True

    # ------------------------------------------------------------------
    # Date ranges
    # ------------------------------------------------------------------
    date_range = {"start": earliest or latest, "end": latest}
    windows = {}
    if latest_d is not None:
        for wid, days in WINDOWS:
            s, e = window_range(latest_d, days)
            windows[wid] = {"start": s.isoformat(), "end": e.isoformat()}
    else:
        for wid, _days in WINDOWS:
            windows[wid] = {"start": None, "end": None}

    # Scope label
    cur = conn.execute("SELECT label FROM scopes WHERE scope_id = ?", (scope_id,))
    row = cur.fetchone()
    scope_label = row["label"] if row else scope_id.title()

    return {
        "schema_version": SCHEMA_VERSION,
        "scope_id": scope_id,
        "scope_label": scope_label,
        "generated_at": _now_iso(),
        "date_range": date_range,
        "windows": windows,
        "nodes": nodes,
        "links": links,
        "legend": {
            "heat_metric": "attention_score",
            "warning_metric": "realization_score",
            "warning_threshold": 0.4,
        },
    }


# ---------------------------------------------------------------------------
# Manifest
# ---------------------------------------------------------------------------


def _build_manifest(conn: sqlite3.Connection, build_id: str) -> dict:
    latest = _latest_report_date(conn) or ""
    cur = conn.execute(
        "SELECT window_id, label, days, is_default FROM metric_windows ORDER BY sort_order"
    )
    windows = [
        {"window_id": r["window_id"], "label": r["label"], "days": r["days"]}
        for r in cur.fetchall()
    ]
    cur = conn.execute("SELECT window_id FROM metric_windows WHERE is_default = 1 LIMIT 1")
    default_window = (cur.fetchone() or {"window_id": "30d"})["window_id"]
    scopes = [
        {"scope_id": "mix",      "label": "Mix",      "graph_file": "graph-mix.json"},
        {"scope_id": "tech",     "label": "Tech",     "graph_file": "graph-tech.json"},
        {"scope_id": "business", "label": "Business", "graph_file": "graph-business.json"},
    ]
    return {
        "schema_version": SCHEMA_VERSION,
        "build_id": build_id,
        "latest_report_date": latest,
        "default_scope": "mix",
        "default_window": default_window,
        "default_locale": DEFAULT_LOCALE,
        "locales": list(LOCALES),
        "windows": windows,
        "scopes": scopes,
    }


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


def _validate_graph(graph: dict) -> list[str]:
    errors: list[str] = []
    node_ids: set[str] = set()
    for node in graph["nodes"]:
        node_ids.add(node["id"])
        for win_id in ("7d", "30d", "90d"):
            if win_id not in node.get("metrics_by_window", {}):
                errors.append(
                    f"node {node['id']} missing metrics_by_window.{win_id}"
                )
    for link in graph["links"]:
        if link["source"] not in node_ids:
            errors.append(f"link {link['id']} references missing source {link['source']}")
        if link["target"] not in node_ids:
            errors.append(f"link {link['id']} references missing target {link['target']}")
    return errors


# ---------------------------------------------------------------------------
# Public entrypoint
# ---------------------------------------------------------------------------


def _build_mix_graph(tech: dict, business: dict, build_id: str) -> dict:
    """Combine tech + business graphs into a single "MIX" graph.

    Category and theme nodes from each scope keep their own ids and
    are included as-is. Prediction nodes share ids across scopes
    (same DB prediction_id), so they are de-duplicated: the first
    occurrence wins, with parent_ids unioned across both scopes so
    the prediction sits under both its tech and business lineages.
    Links are unioned by id; cross-category ``shares_prediction``
    edges are rebuilt after merge so cross-scope bridges show up.
    """
    nodes: list[dict] = []
    id_index: dict[str, dict] = {}

    def ingest(src_nodes):
        for n in src_nodes:
            existing = id_index.get(n["id"])
            if existing is None:
                # deep-ish copy of parent/child lists so downstream
                # mutations don't leak back into the source scope.
                cp = dict(n)
                cp["parent_ids"] = list(n.get("parent_ids", []))
                cp["child_ids"] = list(n.get("child_ids", []))
                nodes.append(cp)
                id_index[cp["id"]] = cp
            else:
                # Merge parent/child id sets so multi-scope predictions
                # connect to all their real parents.
                for pid in n.get("parent_ids", []):
                    if pid not in existing["parent_ids"]:
                        existing["parent_ids"].append(pid)
                for cid in n.get("child_ids", []):
                    if cid not in existing["child_ids"]:
                        existing["child_ids"].append(cid)

    ingest(tech["nodes"])
    ingest(business["nodes"])

    # Merge `contains` links from both scopes, de-duped by id.
    # shares_prediction edges are regenerated so cross-scope links emerge.
    links: list[dict] = []
    seen_link_ids: set[str] = set()
    for src in (tech.get("links", []) or []) + (business.get("links", []) or []):
        if src.get("type") == "shares_prediction":
            continue
        if src["id"] in seen_link_ids:
            continue
        seen_link_ids.add(src["id"])
        links.append(dict(src))

    known_ids = set(id_index.keys())
    cross_cat_pairs: set[tuple[str, str]] = set()
    linked_categories: set[str] = set()
    for node in nodes:
        if node["type"] != "prediction":
            continue
        cats: set[str] = set()
        for pid in node["parent_ids"]:
            pn = id_index.get(pid)
            if pn is None:
                continue
            if pn["type"] in ("theme", "subtheme") and pn.get("category_id"):
                cats.add(pn["category_id"])
        if len(cats) < 2:
            continue
        ordered = sorted(cats)
        linked_categories.update(ordered)
        for i in range(len(ordered)):
            for j in range(i + 1, len(ordered)):
                cross_cat_pairs.add((ordered[i], ordered[j]))
    for (a, b) in sorted(cross_cat_pairs):
        link_id = f"link.shares.{a}__{b}"
        if link_id in seen_link_ids:
            continue
        seen_link_ids.add(link_id)
        links.append({
            "id": link_id,
            "source": a,
            "target": b,
            "type": "shares_prediction",
            "weight": 0.6,
            "status": "active",
        })
    for cat_id in linked_categories:
        cn = id_index.get(cat_id)
        if cn is None:
            continue
        vis = cn.setdefault("visibility", {"min_zoom": 0.0, "max_zoom": None, "default_visible": True})
        vis["min_zoom"] = 0.0
        vis["default_visible"] = True

    return {
        "schema_version": tech.get("schema_version", SCHEMA_VERSION),
        "scope_id": "mix",
        "scope_label": "Mix",
        "generated_at": build_id,
        "date_range": tech.get("date_range") or business.get("date_range"),
        "windows": tech.get("windows") or business.get("windows"),
        "nodes": nodes,
        "links": links,
        "legend": tech.get("legend") or business.get("legend"),
    }


def run_export(
    *, output_dir: Path | None = None, db_path: Path | None = None
) -> dict:
    out_dir = output_dir or docs_data_dir()
    out_dir.mkdir(parents=True, exist_ok=True)

    conn = connect(db_path) if db_path else connect()
    build_id = _now_iso()
    try:
        written: list[str] = []
        scope_graphs: dict[str, dict] = {}

        for scope_id in ("tech", "business"):
            graph = _build_scope_graph(conn, scope_id)
            scope_graphs[scope_id] = graph
            errs = _validate_graph(graph)
            if errs:
                # Surface problems but keep writing — tests will catch.
                graph["_validation_errors"] = errs
            target = out_dir / f"graph-{scope_id}.json"
            serialized = json.dumps(graph, ensure_ascii=False, indent=2)
            target.write_text(serialized, encoding="utf-8")
            written.append(str(target))

            # record in graph_exports
            conn.execute(
                """
                INSERT INTO graph_exports (
                  export_id, scope_id, window_id, output_path, schema_version,
                  generated_at, node_count, link_count, date_start, date_end, content_sha
                ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    _hid("export", scope_id, build_id),
                    scope_id,
                    _rel_to_repo(target),
                    SCHEMA_VERSION,
                    build_id,
                    len(graph["nodes"]),
                    len(graph["links"]),
                    graph["date_range"]["start"],
                    graph["date_range"]["end"],
                    hashlib.sha1(serialized.encode("utf-8")).hexdigest(),
                ),
            )

        # MIX graph = tech + business merged (post-processing).
        mix_graph = _build_mix_graph(
            scope_graphs["tech"], scope_graphs["business"], build_id
        )
        mix_errs = _validate_graph(mix_graph)
        if mix_errs:
            mix_graph["_validation_errors"] = mix_errs
        mix_target = out_dir / "graph-mix.json"
        mix_serialized = json.dumps(mix_graph, ensure_ascii=False, indent=2)
        mix_target.write_text(mix_serialized, encoding="utf-8")
        written.append(str(mix_target))
        conn.execute(
            """
            INSERT INTO graph_exports (
              export_id, scope_id, window_id, output_path, schema_version,
              generated_at, node_count, link_count, date_start, date_end, content_sha
            ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                _hid("export", "mix", build_id),
                "tech",  # graph_exports.scope_id FK — point at any real scope; real identity is the path.
                _rel_to_repo(mix_target),
                SCHEMA_VERSION,
                build_id,
                len(mix_graph["nodes"]),
                len(mix_graph["links"]),
                mix_graph["date_range"]["start"] if mix_graph.get("date_range") else None,
                mix_graph["date_range"]["end"] if mix_graph.get("date_range") else None,
                hashlib.sha1(mix_serialized.encode("utf-8")).hexdigest(),
            ),
        )

        # glossary stream export — terms with status='active' AND a
        # filled definition. The dashboard's app.js reads this on boot
        # and wraps the first occurrence of each term in rendered
        # markdown body text with `<abbr title="…">` for hover tooltips.
        glossary_terms = []
        try:
            cur = conn.execute(
                """
                SELECT term, aliases_json,
                       one_liner_eli14,
                       one_liner_eli14_ja, one_liner_eli14_es, one_liner_eli14_fil,
                       why_it_matters,
                       why_it_matters_ja, why_it_matters_es, why_it_matters_fil,
                       canonical_link
                  FROM glossary_terms
                 WHERE status = 'active'
                   AND one_liner_eli14 IS NOT NULL
                   AND one_liner_eli14 <> ''
                 ORDER BY term
                """
            )
            for row in cur.fetchall():
                aliases = []
                if row["aliases_json"]:
                    try:
                        aliases = json.loads(row["aliases_json"])
                        if not isinstance(aliases, list):
                            aliases = []
                    except (json.JSONDecodeError, TypeError):
                        aliases = []
                en_eli = row["one_liner_eli14"]
                en_why = row["why_it_matters"]

                def _fan(en, ja, es, fil):
                    return {
                        "en": en,
                        "ja": ja if ja else en,
                        "es": es if es else en,
                        "fil": fil if fil else en,
                    }

                glossary_terms.append({
                    "term": row["term"],
                    "aliases": aliases,
                    # Legacy flat fields kept for back-compat with older
                    # frontend builds that don't read the locale dict yet.
                    "one_liner_eli14": en_eli,
                    "why_it_matters": en_why,
                    # Phase 2 brought-forward locale fan-out. Per-locale
                    # NULL falls back to EN at write time so the frontend
                    # can index `entry.eli14[loc]` unconditionally.
                    "eli14": _fan(en_eli, row["one_liner_eli14_ja"], row["one_liner_eli14_es"], row["one_liner_eli14_fil"]),
                    "why":   _fan(en_why, row["why_it_matters_ja"],   row["why_it_matters_es"],   row["why_it_matters_fil"]),
                    "canonical_link": row["canonical_link"],
                })
        except sqlite3.OperationalError:
            # glossary_terms table doesn't exist on a stale DB — skip the export.
            pass
        glossary_path = out_dir / "glossary.json"
        glossary_path.write_text(
            json.dumps(
                {"generated_at": build_id, "terms": glossary_terms},
                ensure_ascii=False, indent=2,
            ),
            encoding="utf-8",
        )
        written.append(str(glossary_path))

        manifest = _build_manifest(conn, build_id)
        manifest_path = out_dir / "manifest.json"
        manifest_path.write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        written.append(str(manifest_path))

        conn.commit()
        return {"files": written, "build_id": build_id}
    finally:
        conn.close()
