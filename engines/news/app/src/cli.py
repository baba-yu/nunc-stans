"""CLI entrypoint: ``python -m src.cli <command>``.

Commands:
    init                - Create DB from schema (idempotent).
    ingest              - Parse report/ + future-prediction/ and upsert.
    ingest-sourcedata   - Read app/sourcedata/<date>/*.json and upsert.
    score               - Compute daily activity rows for all windows.
    export              - Write docs/data/*.json.
    update              - Run sourcedata ingest (any dates with JSON) +
                          markdown ingest (legacy fallback) + score + export.
"""

from __future__ import annotations

import argparse
import sys

from . import db, export, ingest, score


def _cmd_init(args: argparse.Namespace) -> int:
    p = db.init_db()
    print(f"db initialized at {p}")
    return 0


def _cmd_ingest(args: argparse.Namespace) -> int:
    db.init_db()
    result = ingest.run_ingest()
    print(
        f"ingest: news={result['news_files']} validation={result['validation_files']}"
    )
    return 0


def _cmd_ingest_sourcedata(args: argparse.Namespace) -> int:
    """Ingest a single date's app/sourcedata/<date>/*.json files."""
    db.init_db()
    from app.skills import ingest_sourcedata as _isd

    conn = db.connect()
    try:
        summary = _isd.ingest_day(conn, db.repo_root(), args.date)
        loc_summary = _isd.ingest_day_locales(conn, db.repo_root(), args.date)
    finally:
        conn.close()
    print(
        "ingest-sourcedata {date}: predictions={predictions} needs={needs} "
        "bridges={bridges} headlines={headlines} change_log={change_log} "
        "news_section={news_section}".format(**summary)
    )
    for loc in ("ja", "es", "fil"):
        ls = loc_summary.get(loc) or {}
        if any(ls.values()):
            print(
                "  locale {0}: predictions={1} needs={2} bridges={3}".format(
                    loc,
                    ls.get("predictions", 0),
                    ls.get("needs", 0),
                    ls.get("bridges", 0),
                )
            )
    return 0


def _cmd_score(args: argparse.Namespace) -> int:
    db.init_db()
    result = score.run_score()
    print("score:", result)
    return 0


def _cmd_export(args: argparse.Namespace) -> int:
    db.init_db()
    result = export.run_export()
    print("export:")
    for f in result["files"]:
        print(f"  wrote {f}")
    return 0


def _run_sourcedata_pre_ingest() -> dict:
    """Walk ``app/sourcedata/`` and run ingest_day for every date dir.

    Returns a roll-up summary across all sourcedata dates. Empty dict
    when no sourcedata is present (legacy markdown-only corpora).
    """
    from app.skills import ingest_sourcedata as _isd

    dates = _isd.scan_dates(db.repo_root())
    if not dates:
        return {"dates": 0, "ingested_dates": set()}
    totals: dict = {
        "dates": 0,
        "predictions": 0,
        "needs": 0,
        "bridges": 0,
        "ingested_dates": set(),
    }
    conn = db.connect()
    try:
        for d in dates:
            s = _isd.ingest_day(conn, db.repo_root(), d)
            _isd.ingest_day_locales(conn, db.repo_root(), d)
            totals["dates"] += 1
            totals["predictions"] += s.get("predictions", 0)
            totals["needs"] += s.get("needs", 0)
            totals["bridges"] += s.get("bridges", 0)
            # Only count a date as "fully ingested via sourcedata" if
            # the canonical predictions stream was present — bridges-
            # only or headlines-only days still need the legacy
            # markdown ingest to populate prediction rows.
            if s.get("predictions", 0) > 0:
                totals["ingested_dates"].add(d)
    finally:
        conn.close()
    return totals


def _cmd_update(args: argparse.Namespace) -> int:
    db.init_db()
    # Phase 2: sourcedata path runs FIRST so its rows are canonical. The
    # markdown ingest below uses INSERT OR IGNORE on the prediction row
    # and COALESCE on every mutable column, so a second ingest of the
    # same prediction from a legacy markdown file cannot overwrite the
    # sourcedata-derived values.
    sd_totals = _run_sourcedata_pre_ingest()
    ing = ingest.run_ingest(skip_dates=sd_totals.get("ingested_dates"))
    sco = score.run_score()
    exp = export.run_export()
    # evidence-reverse.json is generated outside run_export() (separate skill),
    # but daily flow needs it fresh — without this call the EVIDENCE / Probe NEWS
    # tab lags by up to a week (only refreshed by 5_weekly_theme_review on Sunday).
    # See design/export_layer.md and design/refactoring.md for the historical gap.
    import json as _json
    from app.skills import build_evidence_reverse as _ber
    ber_out = db.repo_root() / "docs" / "data" / "evidence-reverse.json"
    ber_data = _ber.build(db.db_path())
    ber_out.parent.mkdir(parents=True, exist_ok=True)
    ber_out.write_text(_json.dumps(ber_data, indent=2, ensure_ascii=False), encoding="utf-8")
    sd_part = ""
    if sd_totals.get("dates"):
        sd_part = " | sourcedata={dates}d/{predictions}p/{needs}n/{bridges}b".format(
            **sd_totals
        )
    print(
        "update: news={} validation={}{} | latest={} theme_rows={} | wrote {} export files + evidence-reverse ({} rows)".format(
            ing["news_files"],
            ing["validation_files"],
            sd_part,
            sco.get("latest", "-"),
            sco.get("theme_activity_rows", 0),
            len(exp["files"]),
            ber_data["evidence_count"],
        )
    )
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="src.cli")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("init").set_defaults(func=_cmd_init)
    sub.add_parser("ingest").set_defaults(func=_cmd_ingest)
    p_isd = sub.add_parser(
        "ingest-sourcedata",
        help="Ingest app/sourcedata/<date>/*.json (incl. locales) for one date.",
    )
    p_isd.add_argument("--date", required=True, help="ISO date (YYYY-MM-DD).")
    p_isd.set_defaults(func=_cmd_ingest_sourcedata)
    sub.add_parser("score").set_defaults(func=_cmd_score)
    sub.add_parser("export").set_defaults(func=_cmd_export)
    sub.add_parser("update").set_defaults(func=_cmd_update)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
