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


SCHEMA_VERSION = "1.0"

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

    # Load taxonomy
    cur = conn.execute(
        """
        SELECT category_id, label, short_label, description, sort_order
        FROM categories WHERE scope_id = ? AND active = 1 ORDER BY sort_order
        """,
        (scope_id,),
    )
    categories = list(cur.fetchall())

    cur = conn.execute(
        """
        SELECT theme_id, category_id, canonical_label, short_label, description
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
               st.description, t.category_id
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
               p.prediction_date, sf.path AS source_path,
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
        node = {
            "id": node_id,
            "type": "category",
            "scope_id": scope_id,
            "label": cat["label"],
            "short_label": cat["short_label"] or cat["label"],
            "description": cat["description"],
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
            node = {
                "id": node_id,
                "type": "theme",
                "scope_id": scope_id,
                "label": th["canonical_label"],
                "short_label": th["short_label"] or th["canonical_label"],
                "description": th["description"],
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
        node = {
            "id": node_id,
            "type": "subtheme",
            "scope_id": scope_id,
            "label": st["canonical_label"],
            "short_label": st["short_label"] or st["canonical_label"],
            "description": st["description"],
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
            short_label = pr["prediction_short_label"] or (summary[:32] + ("…" if len(summary) > 32 else ""))
            label = summary[:140] + ("…" if len(summary) > 140 else "")

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
            cur = conn.execute(
                """
                SELECT vr.validation_date AS d, sf.path AS path
                FROM validation_rows vr
                JOIN source_files sf ON vr.source_file_id = sf.source_file_id
                WHERE vr.prediction_id = ?
                ORDER BY vr.validation_date DESC
                """,
                (pr["prediction_id"],),
            )
            validation_reports = [
                {"date": r["d"], "path": r["path"]} for r in cur.fetchall()
            ]
            validation_path = validation_reports[0]["path"] if validation_reports else None

            # Primary parent from scope_assignment, plus IDF-matched
            # secondary themes (1:N). Duplicates removed.
            parents = [parent_id]
            for extra_th in extra_theme_parents(summary, pr["theme_id"]):
                if extra_th not in parents:
                    parents.append(extra_th)
            node = {
                "id": node_id,
                "type": "prediction",
                "scope_id": scope_id,
                "label": label,
                "short_label": short_label,
                "description": summary,
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
                    "subtitle": f"Prediction · {scope_id.title()}",
                    "description": summary,
                    "scope_id": scope_id,
                    "node_type": "prediction",
                    "prediction_summary": summary,
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
