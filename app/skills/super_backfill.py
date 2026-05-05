"""Chronological markdown-rooted backfill for ``app/sourcedata/``.

Spec: ``design/skills/super-backfill.md``.

Walks ``report/<L>/news-YYYYMMDD.md`` and
``future-prediction/<L>/future-prediction-YYYYMMDD.md`` oldest-to-newest,
regenerating LLM-derived structured fields into the canonical JSON
sourcedata. Each date stage is atomic; mid-walk failure leaves prior
dates intact and re-runnable.

The Python module is the deterministic half: markdown extraction,
context bundling, schema-validating atomic writes, DB ingest. The LLM
fills happen at the parent-agent level (Claude dispatches one sub-agent
per (date, stream, item) per the operator runbook in
``design/skills/super-backfill.md``).
"""

from __future__ import annotations

import json
import os
import re
from datetime import date, timedelta
from pathlib import Path

from app.skills.sourcedata_schemas import (
    BridgesFile,
    NeedsFile,
    PredictionsFile,
)

_NEWS_RE = re.compile(r"^news-(\d{8})\.md$")
_FP_RE = re.compile(r"^future-prediction-(\d{8})\.md$")

_FUTURE_HEADING_RE = re.compile(r"^##\s+Future\s*$", re.MULTILINE)
_VALID_HEADING_RE = re.compile(r"^##\s+Validation findings\s*$", re.MULTILINE)
_NEXT_H2_RE = re.compile(r"^##\s+\S", re.MULTILINE)
_PRED_HEADER_RE = re.compile(r"^(\d+)\.\s+(.+?)\s*$", re.MULTILINE)
_TABLE_ROW_RE = re.compile(r"^\|(.+)\|\s*$", re.MULTILINE)
_LINK_RE = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")


def _yyyymmdd_to_iso(s: str) -> str:
    return f"{s[:4]}-{s[4:6]}-{s[6:8]}"


def _strip_indent(block: str) -> str:
    """Strip the common leading indent from each line of ``block``.

    The Future-section bodies in real corpus markdown are indented 3
    spaces. Strip the indent uniformly so callers see clean prose.
    Empty lines are preserved as-is.
    """
    lines = block.splitlines()
    indents = [
        len(line) - len(line.lstrip(" "))
        for line in lines
        if line.strip()
    ]
    if not indents:
        return block.strip()
    common = min(indents)
    out = []
    for line in lines:
        if line.strip():
            out.append(line[common:])
        else:
            out.append("")
    return "\n".join(out).strip()


def scan_markdown_dates(repo_root: Path) -> list[tuple[str, bool, bool]]:
    """Return ``[(date_iso, has_news, has_fp), ...]`` sorted ascending.

    Includes any date that has at least one EN markdown (news or FP).
    """
    repo_root = Path(repo_root)
    news_dates: set[str] = set()
    fp_dates: set[str] = set()
    news_dir = repo_root / "report" / "en"
    if news_dir.is_dir():
        for p in news_dir.iterdir():
            m = _NEWS_RE.match(p.name)
            if m:
                news_dates.add(_yyyymmdd_to_iso(m.group(1)))
    fp_dir = repo_root / "future-prediction" / "en"
    if fp_dir.is_dir():
        for p in fp_dir.iterdir():
            m = _FP_RE.match(p.name)
            if m:
                fp_dates.add(_yyyymmdd_to_iso(m.group(1)))
    all_dates = sorted(news_dates | fp_dates)
    return [(d, d in news_dates, d in fp_dates) for d in all_dates]


def extract_predictions_from_news(path: Path) -> list[dict]:
    """Return ``[{"title": ..., "body": ...}, ...]`` from a news markdown.

    Locates the ``## Future`` section, splits it on numbered list markers
    of the form ``^N. <title>``, and pairs each title with the prose
    block(s) following it (up to the next numbered marker or the next
    ``## H2`` heading).

    The real corpus shape is:

        ## Future


        1. <title — NOT bolded>

           **<bolded central claim>** continuing prose...
           In plain language: <plain summary>

        2. <next title>
           ...
        ## Change Log
    """
    text = Path(path).read_text(encoding="utf-8")
    m = _FUTURE_HEADING_RE.search(text)
    if not m:
        return []
    start = m.end()
    nxt = _NEXT_H2_RE.search(text, start)
    section = text[start:nxt.start()] if nxt else text[start:]
    headers = list(_PRED_HEADER_RE.finditer(section))
    out: list[dict] = []
    for i, h in enumerate(headers):
        title = h.group(2).strip()
        body_start = h.end()
        body_end = headers[i + 1].start() if i + 1 < len(headers) else len(section)
        raw_body = section[body_start:body_end]
        body = _strip_indent(raw_body)
        out.append({"title": title, "body": body})
    return out


def extract_validation_rows_from_fp(path: Path) -> list[dict]:
    """Return validation-row dicts from a future-prediction markdown.

    Each dict is shaped for super-backfill's bridge-stream sub-agent
    consumption — missing the ``bridge`` object (the sub-agent regenerates
    it). The shape is:

        {
          "prediction_ref": {
            "id": "",                  # filled by sub-agent / prior-day lookup
            "short_label": "...",
            "prediction_date": "YYYY-MM-DD"
          },
          "today_relevance": <int>,
          "evidence_summary": "<raw col 4 text — sub-agent regenerates>",
          "reference_links": [{"label": "...", "url": "..."}, ...]
        }

    Skips the table header row, the separator row, and any row with
    fewer than 5 cells.
    """
    text = Path(path).read_text(encoding="utf-8")
    m = _VALID_HEADING_RE.search(text)
    if not m:
        return []
    start = m.end()
    nxt = _NEXT_H2_RE.search(text, start)
    section = text[start:nxt.start()] if nxt else text[start:]
    out: list[dict] = []
    for row_m in _TABLE_ROW_RE.finditer(section):
        cells = [c.strip() for c in row_m.group(1).split("|")]
        if len(cells) != 5:
            continue
        if cells[0].startswith("---") or cells[0].startswith(":-"):
            continue
        if cells[0].lower().startswith("prediction"):
            continue
        short_label, pred_date, relevance_raw, ev_raw, refs_cell = cells
        try:
            relevance_i = int(relevance_raw)
        except ValueError:
            relevance_i = 0
        links = [
            {"label": lab.strip(), "url": url.strip()}
            for lab, url in _LINK_RE.findall(refs_cell)
        ]
        out.append({
            "prediction_ref": {
                "id": "",
                "short_label": short_label,
                "prediction_date": pred_date,
            },
            "today_relevance": relevance_i,
            "evidence_summary": ev_raw,
            "reference_links": links,
        })
    return out


def prior_predictions_window(
    repo_root: Path, date_iso: str, n: int = 7
) -> list[dict]:
    """Return predictions from the prior ``n`` days of sourcedata.

    Used to give bridge sub-agents chronological context: a validation row
    that references a prediction from 6 days ago needs that prediction's
    body + reasoning available so the bridge narrative can cite it
    correctly.

    Each entry preserves the JSON id, title, body, prediction_date,
    reasoning, and summary fields. Days with missing or unreadable
    ``predictions.json`` are silently skipped.
    """
    repo_root = Path(repo_root)
    y, mo, d = (int(p) for p in date_iso.split("-"))
    cur = date(y, mo, d)
    out: list[dict] = []
    for k in range(1, n + 1):
        prior = cur - timedelta(days=k)
        prior_iso = prior.isoformat()
        path = repo_root / "app" / "sourcedata" / prior_iso / "predictions.json"
        if not path.is_file():
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        for entry in data.get("predictions", []):
            out.append({
                "id": entry.get("id"),
                "title": entry.get("title"),
                "body": entry.get("body"),
                "prediction_date": prior_iso,
                "reasoning": entry.get("reasoning"),
                "summary": entry.get("summary"),
            })
    return out


def prepare_context(repo_root: Path, date_iso: str) -> dict:
    """Build the per-day context bundle that drives sub-agent dispatch.

    Output shape::

        {
          "date": "<YYYY-MM-DD>",
          "predictions_to_compose": [{"title": ..., "body": ...}, ...],
          "validation_rows_to_bridge": [<row>, ...],
          "prior_predictions": [<entry>, ...]
        }

    ``predictions_to_compose`` and ``validation_rows_to_bridge`` are
    empty when their source markdown is missing for that date.
    """
    repo_root = Path(repo_root)
    yyyymmdd = date_iso.replace("-", "")
    news_path = repo_root / "report" / "en" / f"news-{yyyymmdd}.md"
    fp_path = (
        repo_root / "future-prediction" / "en" / f"future-prediction-{yyyymmdd}.md"
    )
    preds = (
        extract_predictions_from_news(news_path) if news_path.is_file() else []
    )
    rows = (
        extract_validation_rows_from_fp(fp_path) if fp_path.is_file() else []
    )
    prior = prior_predictions_window(repo_root, date_iso)
    return {
        "date": date_iso,
        "predictions_to_compose": preds,
        "validation_rows_to_bridge": rows,
        "prior_predictions": prior,
    }


# ---------------------------------------------------------------------------
# Apply hooks: schema-validate then atomic-write a stream JSON for one date.
# ---------------------------------------------------------------------------


def _atomic_write_json(path: Path, payload: dict) -> Path:
    """Write ``payload`` as JSON to ``path`` atomically.

    Creates parent directories as needed. Validation MUST happen before
    calling this — by the time the temp file lands at ``path`` it should
    be the final, schema-valid content.
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    os.replace(tmp, path)
    return path


def _date_dir(repo_root: Path, date_iso: str) -> Path:
    return Path(repo_root) / "app" / "sourcedata" / date_iso


def apply_predictions(
    repo_root: Path, date_iso: str, payload: dict
) -> Path:
    """Validate + atomically write ``app/sourcedata/<date>/predictions.json``.

    Raises ``SourcedataValidationError`` on schema failure. No file is
    created when validation fails.
    """
    PredictionsFile.from_dict(payload)
    return _atomic_write_json(
        _date_dir(repo_root, date_iso) / "predictions.json", payload
    )


def apply_bridges(repo_root: Path, date_iso: str, payload: dict) -> Path:
    """Validate + atomically write ``app/sourcedata/<date>/bridges.json``."""
    BridgesFile.from_dict(payload)
    return _atomic_write_json(
        _date_dir(repo_root, date_iso) / "bridges.json", payload
    )


def apply_needs(repo_root: Path, date_iso: str, payload: dict) -> Path:
    """Validate + atomically write ``app/sourcedata/<date>/needs.json``."""
    NeedsFile.from_dict(payload)
    return _atomic_write_json(
        _date_dir(repo_root, date_iso) / "needs.json", payload
    )


_VALID_LOCALES = ("ja", "es", "fil")
_STREAM_VALIDATORS = {
    "predictions": PredictionsFile,
    "bridges": BridgesFile,
    "needs": NeedsFile,
}


def apply_locale(
    repo_root: Path,
    date_iso: str,
    locale: str,
    stream: str,
    payload: dict,
) -> Path:
    """Validate + atomically write a locale-specific stream JSON.

    Output path: ``app/sourcedata/locales/<date>/<locale>/<stream>.json``.

    Locale JSONs share the EN schemas (PredictionsFile, BridgesFile,
    NeedsFile), so the same validators apply.
    """
    if locale not in _VALID_LOCALES:
        raise ValueError(
            f"unknown locale: {locale!r}; expected one of {_VALID_LOCALES}"
        )
    if stream not in _STREAM_VALIDATORS:
        raise ValueError(
            f"unknown stream: {stream!r}; expected one of {tuple(_STREAM_VALIDATORS)}"
        )
    _STREAM_VALIDATORS[stream].from_dict(payload)
    out = (
        Path(repo_root)
        / "app"
        / "sourcedata"
        / "locales"
        / date_iso
        / locale
        / f"{stream}.json"
    )
    return _atomic_write_json(out, payload)


# ---------------------------------------------------------------------------
# commit_day: ingest the day's sourcedata into the analytics DB.
# ---------------------------------------------------------------------------


def commit_day(conn, repo_root: Path, date_iso: str) -> dict:
    """Ingest ``app/sourcedata/<date>/*.json`` (and locales) into the DB.

    Thin wrapper around
    :func:`app.skills.ingest_sourcedata.ingest_day` +
    :func:`ingest_day_locales`, returning a roll-up dict::

        {
          "date": "<YYYY-MM-DD>",
          "predictions": <int>,
          "needs": <int>,
          "bridges": <int>,
          "headlines": <int>,
          "change_log": <int>,
          "news_section": <int>,
          "locales": {<locale>: {"predictions": <int>, ...}, ...}
        }

    Idempotent: re-running with the same JSON files produces the same DB
    state.
    """
    from app.skills import ingest_sourcedata as _isd

    summary = _isd.ingest_day(conn, Path(repo_root), date_iso)
    loc_summary = _isd.ingest_day_locales(conn, Path(repo_root), date_iso)
    return {**summary, "locales": {k: v for k, v in loc_summary.items() if k != "date"}}


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    """Argparse entry point for ``python -m app.skills.super_backfill``.

    Subcommands:

      * ``scan`` — print ``[(date, has_news, has_fp), ...]`` JSON.
      * ``prepare --date <D>`` — print per-day context bundle JSON.
      * ``apply --date <D> --stream <s> [--locale <L>] --json-file <p>`` —
        validate and atomically write a stream JSON.
      * ``commit-day --date <D>`` — ingest the date's sourcedata into the
        analytics DB. Opens a connection via ``app.src.db.connect``.
    """
    import argparse

    parser = argparse.ArgumentParser(prog="python -m app.skills.super_backfill")
    parser.add_argument(
        "--repo-root",
        default=".",
        help="Repo root (default: cwd)",
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("scan", help="List dates with EN news/FP markdown")

    pp = sub.add_parser("prepare", help="Print context bundle for one date")
    pp.add_argument("--date", required=True)

    ap = sub.add_parser(
        "apply", help="Validate + write a stream JSON for one date"
    )
    ap.add_argument("--date", required=True)
    ap.add_argument(
        "--stream",
        required=True,
        choices=("predictions", "bridges", "needs"),
    )
    ap.add_argument(
        "--locale",
        default=None,
        help="Set for locale fan-in (ja/es/fil)",
    )
    ap.add_argument("--json-file", required=True)

    cp = sub.add_parser(
        "commit-day", help="Ingest the date's sourcedata into the DB"
    )
    cp.add_argument("--date", required=True)

    args = parser.parse_args(argv)
    repo_root = Path(args.repo_root).resolve()

    if args.cmd == "scan":
        print(
            json.dumps(scan_markdown_dates(repo_root), ensure_ascii=False)
        )
        return 0
    if args.cmd == "prepare":
        print(
            json.dumps(
                prepare_context(repo_root, args.date),
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0
    if args.cmd == "apply":
        payload = json.loads(
            Path(args.json_file).read_text(encoding="utf-8")
        )
        if args.locale:
            out = apply_locale(
                repo_root, args.date, args.locale, args.stream, payload
            )
        else:
            apply_fn = {
                "predictions": apply_predictions,
                "bridges": apply_bridges,
                "needs": apply_needs,
            }[args.stream]
            out = apply_fn(repo_root, args.date, payload)
        print(f"OK {out}")
        return 0
    if args.cmd == "commit-day":
        from app.src import db as _db

        conn = _db.connect()
        try:
            summary = commit_day(conn, repo_root, args.date)
        finally:
            conn.close()
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return 0
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
