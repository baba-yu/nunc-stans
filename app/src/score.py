"""Compute daily activity rows for themes, subthemes, categories, and
prediction realization snapshots across 7d / 30d / 90d windows.

This is deliberately simple: for each ``(scope, theme, window)`` we
compute a single aggregate metric bundle based on the prediction
assignments in that scope/theme plus their evidence links inside the
window. We store only one activity row per theme — the one dated at
``latest_report_date``.
"""

from __future__ import annotations

import hashlib
import sqlite3
from datetime import date
from pathlib import Path

from .analytics.scoring import (
    attention_score,
    continuing_signal_from_sum,
    grass_level,
    new_signal_from_sum,
    normalize_relevance,
    prediction_status,
    realization_score,
    theme_status,
)
from .analytics.windows import WINDOWS, parse_iso_date, window_range
from .db import connect


def _now() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _hid(prefix: str, *parts: str) -> str:
    h = hashlib.sha1("||".join(parts).encode("utf-8")).hexdigest()[:16]
    return f"{prefix}.{h}"


def _latest_report_date(conn: sqlite3.Connection) -> date | None:
    cur = conn.execute(
        "SELECT MAX(report_date) AS d FROM source_files WHERE file_type = 'daily_report'"
    )
    row = cur.fetchone()
    if not row or not row["d"]:
        return None
    return parse_iso_date(row["d"])


def _earliest_report_date(conn: sqlite3.Connection) -> date | None:
    cur = conn.execute(
        "SELECT MIN(report_date) AS d FROM source_files WHERE file_type = 'daily_report'"
    )
    row = cur.fetchone()
    if not row or not row["d"]:
        return None
    return parse_iso_date(row["d"])


def run_score(db_path: Path | None = None) -> dict:
    """Compute and upsert daily activity rows."""
    conn = connect(db_path) if db_path else connect()
    try:
        latest = _latest_report_date(conn)
        if latest is None:
            return {"status": "no-data"}

        # 1. theme daily activity per window/scope
        theme_rows = 0
        for scope_id in ("tech", "business"):
            theme_rows += _score_themes(conn, scope_id=scope_id, latest=latest)

        # 2. category daily activity per window/scope (aggregated from themes)
        category_rows = 0
        for scope_id in ("tech", "business"):
            category_rows += _score_categories(
                conn, scope_id=scope_id, latest=latest
            )

        # 3. prediction realization snapshots per window/scope
        pred_rows = _snapshot_predictions(conn, latest=latest)

        conn.commit()
        return {
            "latest": latest.isoformat(),
            "theme_activity_rows": theme_rows,
            "category_activity_rows": category_rows,
            "prediction_snapshots": pred_rows,
        }
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Theme scoring
# ---------------------------------------------------------------------------


def _score_themes(
    conn: sqlite3.Connection, *, scope_id: str, latest: date
) -> int:
    cur = conn.execute(
        """
        SELECT theme_id, category_id, first_seen_date
        FROM themes
        WHERE scope_id = ? AND status IN ('active', 'candidate')
        """,
        (scope_id,),
    )
    themes = cur.fetchall()
    inserted = 0
    for theme in themes:
        for window_id, days in WINDOWS:
            start, end = window_range(latest, days)
            metrics = _theme_window_metrics(
                conn,
                scope_id=scope_id,
                theme_id=theme["theme_id"],
                window_start=start,
                window_end=end,
            )
            _upsert_topic_activity(
                conn,
                activity_date=latest.isoformat(),
                window_id=window_id,
                scope_id=scope_id,
                category_id=theme["category_id"],
                theme_id=theme["theme_id"],
                subtheme_id=None,
                activity_level="theme",
                metrics=metrics,
                first_seen=theme["first_seen_date"],
            )
            inserted += 1
    return inserted


def _theme_window_metrics(
    conn: sqlite3.Connection,
    *,
    scope_id: str,
    theme_id: str,
    window_start: date,
    window_end: date,
) -> dict:
    """Aggregate the prediction/validation signals for a theme in a window."""
    # Pull all prediction-evidence links whose validation_date falls in the window
    # for predictions assigned to this theme in this scope.
    cur = conn.execute(
        """
        SELECT pel.relatedness_score, pel.evidence_strength,
               pel.contradiction_score, pel.evidence_recency_type
        FROM prediction_evidence_links pel
        JOIN prediction_scope_assignments psa
          ON pel.prediction_id = psa.prediction_id
         AND pel.scope_id = psa.scope_id
        WHERE psa.scope_id = ?
          AND psa.theme_id = ?
          AND pel.validation_date BETWEEN ? AND ?
        """,
        (scope_id, theme_id, window_start.isoformat(), window_end.isoformat()),
    )
    rows = cur.fetchall()

    new_relevance: list[float] = []
    cont_relevance: list[float] = []

    for r in rows:
        strength = r["evidence_strength"] or 0.0
        if r["evidence_recency_type"] == "new":
            new_relevance.append(strength)
        else:
            cont_relevance.append(strength)

    # Also pull prediction count for the theme (in-scope, regardless of window).
    cur = conn.execute(
        """
        SELECT COUNT(*) AS cnt
        FROM prediction_scope_assignments
        WHERE scope_id = ? AND theme_id = ?
        """,
        (scope_id, theme_id),
    )
    prediction_count = cur.fetchone()["cnt"] or 0

    # Frequency × relevance: saturate the summed normalized relevances
    # rather than collapsing to max(). One relevance-5 hit now reads
    # different from five relevance-5 hits.
    new_sum = sum(new_relevance)
    cont_sum = sum(cont_relevance)
    new_signal = new_signal_from_sum(new_sum)
    continuing_signal = continuing_signal_from_sum(cont_sum)
    contradiction_signal = 0.0  # retired — kept in schema for compat, always 0.
    atten = attention_score(new_signal, continuing_signal)
    mean_new = (sum(new_relevance) / len(new_relevance)) if new_relevance else 0.0
    mean_cont = (sum(cont_relevance) / len(cont_relevance)) if cont_relevance else 0.0
    realization = realization_score(mean_new, mean_cont)
    gl = grass_level(atten)
    status = theme_status(atten, realization)

    # Streak: count consecutive dates ending at window_end with any evidence.
    streak_days = _streak(
        conn,
        scope_id=scope_id,
        theme_id=theme_id,
        window_end=window_end,
    )

    return {
        "new_signal": new_signal,
        "continuing_signal": continuing_signal,
        "contradiction_signal": contradiction_signal,
        "attention_score": atten,
        "realization_score": realization,
        "grass_level": gl,
        "status": status,
        "new_evidence_count": len(new_relevance),
        "active_prior_evidence_count": len(cont_relevance),
        "prediction_count": prediction_count,
        "streak_days": streak_days,
    }


def _streak(
    conn: sqlite3.Connection,
    *,
    scope_id: str,
    theme_id: str,
    window_end: date,
) -> int:
    cur = conn.execute(
        """
        SELECT DISTINCT pel.validation_date
        FROM prediction_evidence_links pel
        JOIN prediction_scope_assignments psa
          ON pel.prediction_id = psa.prediction_id
         AND pel.scope_id = psa.scope_id
        WHERE psa.scope_id = ? AND psa.theme_id = ?
        """,
        (scope_id, theme_id),
    )
    dates = {parse_iso_date(r["validation_date"]) for r in cur.fetchall() if r["validation_date"]}
    streak = 0
    cursor = window_end
    while cursor in dates:
        streak += 1
        from datetime import timedelta

        cursor = cursor - timedelta(days=1)
    return streak


def _upsert_topic_activity(
    conn: sqlite3.Connection,
    *,
    activity_date: str,
    window_id: str,
    scope_id: str,
    category_id: str | None,
    theme_id: str,
    subtheme_id: str | None,
    activity_level: str,
    metrics: dict,
    first_seen: str | None,
) -> None:
    activity_id = _hid(
        "activity",
        scope_id,
        theme_id,
        subtheme_id or "",
        window_id,
        activity_date,
        activity_level,
    )
    conn.execute(
        """
        INSERT OR REPLACE INTO topic_daily_activity (
          activity_id, activity_date, window_id, scope_id,
          category_id, theme_id, subtheme_id, activity_level,
          new_signal, continuing_signal, contradiction_signal,
          attention_score, realization_score, grass_level,
          new_evidence_count, active_prior_evidence_count, prediction_count,
          status, streak_days, last_active_date, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?,
                  ?, ?, ?,
                  ?, ?, ?,
                  ?, ?, ?,
                  ?, ?, ?, ?)
        """,
        (
            activity_id,
            activity_date,
            window_id,
            scope_id,
            category_id,
            theme_id,
            subtheme_id,
            activity_level,
            metrics["new_signal"],
            metrics["continuing_signal"],
            metrics["contradiction_signal"],
            metrics["attention_score"],
            metrics["realization_score"],
            metrics["grass_level"],
            metrics["new_evidence_count"],
            metrics["active_prior_evidence_count"],
            metrics["prediction_count"],
            metrics["status"],
            metrics["streak_days"],
            activity_date,
            _now(),
        ),
    )


# ---------------------------------------------------------------------------
# Category scoring
# ---------------------------------------------------------------------------


def _score_categories(
    conn: sqlite3.Connection, *, scope_id: str, latest: date
) -> int:
    cur = conn.execute(
        "SELECT category_id FROM categories WHERE scope_id = ? AND active = 1",
        (scope_id,),
    )
    categories = [r["category_id"] for r in cur.fetchall()]
    inserted = 0
    priority = ["new", "active", "continuing", "dormant"]
    for category_id in categories:
        for window_id, _days in WINDOWS:
            cur = conn.execute(
                """
                SELECT attention_score, realization_score, contradiction_signal,
                       grass_level, status, prediction_count
                FROM topic_daily_activity
                WHERE scope_id = ? AND category_id = ? AND window_id = ?
                  AND activity_level = 'theme' AND activity_date = ?
                """,
                (scope_id, category_id, window_id, latest.isoformat()),
            )
            rows = cur.fetchall()
            if not rows:
                metrics = {
                    "attention_score": 0.0,
                    "realization_score": 0.0,
                    "contradiction_signal": 0.0,
                    "grass_level": 0,
                    "theme_count": 0,
                    "active_theme_count": 0,
                    "prediction_count": 0,
                    "status": "dormant",
                }
            else:
                atts = [r["attention_score"] or 0.0 for r in rows]
                rels = [r["realization_score"] or 0.0 for r in rows]
                pred_counts = [r["prediction_count"] or 0 for r in rows]
                pred_total = sum(pred_counts)
                # Weighted avg realization by prediction_count, fallback plain avg.
                if pred_total > 0:
                    realization = sum(
                        (r["realization_score"] or 0.0) * (r["prediction_count"] or 0)
                        for r in rows
                    ) / pred_total
                else:
                    realization = sum(rels) / len(rels)
                atten = max(atts)
                # Choose strongest status by priority.
                status = "dormant"
                for p in priority:
                    if any(r["status"] == p for r in rows):
                        status = p
                        break
                metrics = {
                    "attention_score": atten,
                    "realization_score": realization,
                    "contradiction_signal": 0.0,
                    "grass_level": grass_level(atten),
                    "theme_count": len(rows),
                    "active_theme_count": sum(
                        1 for r in rows if r["status"] in ("active", "continuing", "new")
                    ),
                    "prediction_count": pred_total,
                    "status": status,
                }
            _upsert_category_activity(
                conn,
                activity_date=latest.isoformat(),
                window_id=window_id,
                scope_id=scope_id,
                category_id=category_id,
                metrics=metrics,
            )
            inserted += 1
    return inserted


def _upsert_category_activity(
    conn: sqlite3.Connection,
    *,
    activity_date: str,
    window_id: str,
    scope_id: str,
    category_id: str,
    metrics: dict,
) -> None:
    activity_id = _hid(
        "catactivity", scope_id, category_id, window_id, activity_date
    )
    conn.execute(
        """
        INSERT OR REPLACE INTO category_daily_activity (
          category_activity_id, activity_date, window_id, scope_id, category_id,
          attention_score, realization_score, contradiction_signal, grass_level,
          theme_count, active_theme_count, prediction_count, status, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            activity_id,
            activity_date,
            window_id,
            scope_id,
            category_id,
            metrics["attention_score"],
            metrics["realization_score"],
            metrics["contradiction_signal"],
            metrics["grass_level"],
            metrics["theme_count"],
            metrics["active_theme_count"],
            metrics["prediction_count"],
            metrics["status"],
            _now(),
        ),
    )


# ---------------------------------------------------------------------------
# Prediction snapshot
# ---------------------------------------------------------------------------


def _snapshot_predictions(conn: sqlite3.Connection, *, latest: date) -> int:
    cur = conn.execute(
        """
        SELECT p.prediction_id, psa.scope_id,
               psa.latest_observed_relevance,
               psa.latest_realization_score,
               psa.latest_contradiction_score
        FROM predictions p
        JOIN prediction_scope_assignments psa ON p.prediction_id = psa.prediction_id
        """
    )
    rows = cur.fetchall()
    n = 0
    for row in rows:
        realization = row["latest_realization_score"] or 0.0
        contradiction = 0.0  # retired; column kept for schema compat.
        new_rel = normalize_relevance(row["latest_observed_relevance"])
        status = prediction_status(realization)
        for window_id, _days in WINDOWS:
            conn.execute(
                """
                INSERT OR REPLACE INTO prediction_realization_snapshots (
                  prediction_id, scope_id, validation_date, window_id,
                  new_evidence_relevance, continuing_evidence_relevance,
                  observed_relevance, realization_score, contradiction_score,
                  observation_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    row["prediction_id"],
                    row["scope_id"],
                    latest.isoformat(),
                    window_id,
                    new_rel,
                    0.0,
                    row["latest_observed_relevance"],
                    realization,
                    contradiction,
                    status,
                ),
            )
            # Update latest_observation_status on assignment for convenience.
            conn.execute(
                """
                UPDATE prediction_scope_assignments
                SET latest_observation_status = ?
                WHERE prediction_id = ? AND scope_id = ?
                """,
                (status, row["prediction_id"], row["scope_id"]),
            )
            n += 1
    return n
