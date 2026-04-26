"""CLI entrypoint: ``python -m src.cli <command>``.

Commands:
    init     - Create DB from schema (idempotent).
    ingest   - Parse report/ + future-prediction/ and upsert.
    score    - Compute daily activity rows for all windows.
    export   - Write docs/data/*.json.
    update   - Run ingest + score + export.
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


def _cmd_update(args: argparse.Namespace) -> int:
    db.init_db()
    ing = ingest.run_ingest()
    sco = score.run_score()
    exp = export.run_export()
    print(
        "update: news={} validation={} | latest={} theme_rows={} | wrote {} files".format(
            ing["news_files"],
            ing["validation_files"],
            sco.get("latest", "-"),
            sco.get("theme_activity_rows", 0),
            len(exp["files"]),
        )
    )
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="src.cli")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("init").set_defaults(func=_cmd_init)
    sub.add_parser("ingest").set_defaults(func=_cmd_ingest)
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
