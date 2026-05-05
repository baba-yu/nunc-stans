"""Build docs/data/evidence-reverse.json (Stream F — Phase 3).

For each high-traffic evidence item, list the predictions it has supported
or contradicted in the past 90 days, along with a contribution score.
The dashboard's EVIDENCE tab consumes this JSON.

Spec: ``design/skills/build-evidence-reverse.md`` (lightweight skill spec).
"""

from __future__ import annotations

import argparse
import json
import math
import sqlite3
import sys
from collections import defaultdict
from pathlib import Path


_DECAY_TAU_DAYS = {
    "release": 14,
    "news": 14,
    "security_advisory": 30,
    "business": 60,
    "social": 7,
    "default": 30,
}


def _decay_for(kind: str | None) -> int:
    return _DECAY_TAU_DAYS.get(kind or "default", _DECAY_TAU_DAYS["default"])


def _days_ago(date_iso: str, today: str) -> int:
    if not date_iso:
        return 9999
    import datetime as dt
    try:
        d = dt.date.fromisoformat(date_iso[:10])
        t = dt.date.fromisoformat(today[:10])
        return max((t - d).days, 0)
    except ValueError:
        return 9999


def build(db_path: Path, *, top_n: int = 200, today_iso: str | None = None) -> dict:
    if not db_path.is_file():
        raise FileNotFoundError(f"DB not found: {db_path}")
    if today_iso is None:
        import datetime as dt
        today_iso = dt.date.today().isoformat()

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        cur = conn.execute(
            """
            SELECT pel.evidence_id, pel.prediction_id, pel.scope_id,
                   pel.support_direction, pel.relatedness_score,
                   pel.evidence_strength, pel.validation_date,
                   ev.url, ev.title, ev.source_type, ev.first_seen_date,
                   p.prediction_summary, p.prediction_short_label,
                   p.prediction_date
              FROM prediction_evidence_links pel
              JOIN evidence_items ev ON pel.evidence_id = ev.evidence_id
              JOIN predictions p ON pel.prediction_id = p.prediction_id
             WHERE pel.validation_date >= date(?, '-90 days')
            """,
            (today_iso,),
        )
        rows = list(cur.fetchall())
    finally:
        conn.close()

    by_ev: dict[str, dict] = defaultdict(lambda: {"linked_predictions": []})
    for r in rows:
        ev = r["evidence_id"]
        ent = by_ev[ev]
        if "title" not in ent:
            ent["evidence_id"] = ev
            ent["title"] = r["title"]
            ent["url"] = r["url"]
            ent["source_type"] = r["source_type"]
            # The day this article was first cited in any validation report.
            ent["reported_at"] = r["first_seen_date"]
        # Contribution score = relatedness * exp(-age/tau)
        age = _days_ago(r["validation_date"], today_iso)
        tau = _decay_for(r["source_type"])
        score = (r["relatedness_score"] or 0.0) * math.exp(-age / max(tau, 1))
        ent["linked_predictions"].append(
            {
                "prediction_id": r["prediction_id"],
                "scope_id": r["scope_id"],
                "support_direction": r["support_direction"],
                "score": round(score, 4),
                "validation_date": r["validation_date"],
                # No length cap: UI handles ellipsis. Truncating here
                # used to drop the rest of the summary on the floor.
                "prediction_summary": r["prediction_summary"],
                "prediction_short_label": r["prediction_short_label"],
                "prediction_date": r["prediction_date"],
            }
        )

    # Sort each evidence's predictions by score; rank evidence by total score.
    for ent in by_ev.values():
        # The DB stores one row per (prediction, evidence, scope, validation_date),
        # so the same prediction×evidence pair appears multiple times when it lives
        # under both scopes or gets re-cited on multiple dates. Collapse to one row
        # per pair (keeping the highest-scored variant) before totaling, otherwise
        # a single news item gets credited several times for the same prediction.
        best: dict[str, dict] = {}
        for p in ent["linked_predictions"]:
            cur = best.get(p["prediction_id"])
            if cur is None or p["score"] > cur["score"]:
                best[p["prediction_id"]] = p
        ent["linked_predictions"] = sorted(best.values(), key=lambda p: -p["score"])
        ent["total_score"] = round(sum(p["score"] for p in ent["linked_predictions"]), 4)

    ranked = sorted(by_ev.values(), key=lambda e: -e["total_score"])[:top_n]
    return {
        "generated_at": today_iso,
        "top_n": top_n,
        "evidence_count": len(ranked),
        "evidence": ranked,
    }


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Build docs/data/evidence-reverse.json (Stream F)")
    p.add_argument("--db", required=True, type=Path)
    p.add_argument("--out", default=Path("docs/data/evidence-reverse.json"), type=Path)
    p.add_argument("--top-n", type=int, default=200)
    args = p.parse_args(argv)
    try:
        data = build(args.db, top_n=args.top_n)
    except FileNotFoundError as e:
        print(f"FAIL {e}", file=sys.stderr)
        return 2
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"OK wrote {args.out} ({len(data['evidence'])} evidence rows)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
