"""Tests for ``app.skills.super_backfill`` — chronological backfill walker."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

import pytest

from app.skills import super_backfill as sb
from app.skills.sourcedata_schemas import SourcedataValidationError


REPO_ROOT_REAL = Path(__file__).resolve().parents[2]
SCHEMA_SQL = (REPO_ROOT_REAL / "app" / "src" / "schema.sql").read_text(
    encoding="utf-8"
)


@pytest.fixture()
def fake_repo(tmp_path: Path) -> Path:
    """Stand up a minimal fake repo: empty ``app/sourcedata/`` ready to fill."""
    (tmp_path / "app" / "sourcedata").mkdir(parents=True)
    return tmp_path


@pytest.fixture()
def conn() -> sqlite3.Connection:
    c = sqlite3.connect(":memory:")
    c.row_factory = sqlite3.Row
    c.executescript(SCHEMA_SQL)
    yield c
    c.close()


def _valid_predictions_payload(date_iso: str = "2026-04-22") -> dict:
    return {
        "date": date_iso,
        "predictions": [
            {
                "id": "prediction.aaaa1111bbbb2222",
                "title": "Test prediction",
                "body": "A test body of multiple sentences.",
                "reasoning": {
                    "because": "premise A",
                    "given": "premise B",
                    "so_that": "predicted state",
                    "landing": "by Q4 2026",
                    "plain_language": "kids version of this prediction",
                },
                "summary": "Short summary, well under 300 chars.",
            }
        ],
    }


def test_scan_markdown_dates_returns_union_sorted(tmp_path):
    """Every date with EN news OR EN FP appears, sorted ascending,
    with flags for which markdown exists."""
    (tmp_path / "report/en").mkdir(parents=True)
    (tmp_path / "future-prediction/en").mkdir(parents=True)
    for d in ("20260419", "20260420", "20260422", "20260423"):
        (tmp_path / f"report/en/news-{d}.md").write_text("x", encoding="utf-8")
    for d in ("20260422", "20260423"):
        (tmp_path / f"future-prediction/en/future-prediction-{d}.md").write_text(
            "x", encoding="utf-8"
        )
    out = sb.scan_markdown_dates(tmp_path)
    assert out == [
        ("2026-04-19", True, False),
        ("2026-04-20", True, False),
        ("2026-04-22", True, True),
        ("2026-04-23", True, True),
    ]


def test_scan_markdown_dates_empty_repo(tmp_path):
    assert sb.scan_markdown_dates(tmp_path) == []


def test_scan_markdown_dates_ignores_non_matching_files(tmp_path):
    (tmp_path / "report/en").mkdir(parents=True)
    (tmp_path / "report/en/news-20260419.md").write_text("x", encoding="utf-8")
    (tmp_path / "report/en/news-20260419.md.bak").write_text("x", encoding="utf-8")
    (tmp_path / "report/en/README.md").write_text("x", encoding="utf-8")
    out = sb.scan_markdown_dates(tmp_path)
    assert out == [("2026-04-19", True, False)]


# ---------------------------------------------------------------------------
# Task 3: extract_predictions_from_news
#
# Real markdown shape (confirmed against report/en/news-20260504.md):
#
#   ## Future
#
#
#   1. Title line, NOT bolded
#
#      **Body sentence first sentence in bold.** Continuing prose, possibly
#      multi-paragraph, with "In plain language: ..." tail markers.
#
#
#   2. Second title
#
#      ...
#
#   ## Change Log
# ---------------------------------------------------------------------------


def test_extract_predictions_from_news_real_format(tmp_path):
    md = (
        "# Daily News 2026-04-22\n\n"
        "## Quick Reads\n\n"
        "- A plain headline.\n\n"
        "## Headlines\n\n"
        "- **Lead** body.\n\n"
        "## Future\n\n\n"
        "1. Hyperscaler-partner enterprise-AI JV template publishes by Q4 2026\n\n"
        "   **By Q4 2026 the parallel-JV launch combined with policy pressure** "
        "forces ≥1 hyperscaler partner to ship a structurally analogous "
        "JV template. In plain language: clouds will copy the shape.\n\n\n"
        "2. Second prediction title here\n\n"
        "   **Body of the second prediction** with more prose.\n\n"
        "## Change Log\n\n"
        "- (changes)\n"
    )
    p = tmp_path / "news-20260422.md"
    p.write_text(md, encoding="utf-8")
    out = sb.extract_predictions_from_news(p)
    assert len(out) == 2
    assert (
        out[0]["title"]
        == "Hyperscaler-partner enterprise-AI JV template publishes by Q4 2026"
    )
    assert out[0]["body"].startswith("**By Q4 2026")
    assert "In plain language" in out[0]["body"]
    assert out[1]["title"] == "Second prediction title here"
    assert "Body of the second prediction" in out[1]["body"]


def test_extract_predictions_handles_no_future_section(tmp_path):
    p = tmp_path / "news-20260419.md"
    p.write_text(
        "# Daily News 2026-04-19\n\n## News\n\n- bullet.\n",
        encoding="utf-8",
    )
    assert sb.extract_predictions_from_news(p) == []


def test_extract_predictions_strips_leading_indent_from_body(tmp_path):
    """Real corpus indents body lines by 3 spaces; extractor returns clean prose."""
    md = (
        "## Future\n\n\n"
        "1. T1\n\n"
        "   line1\n"
        "   line2\n\n"
        "## Change Log\n"
    )
    p = tmp_path / "news-20260422.md"
    p.write_text(md, encoding="utf-8")
    out = sb.extract_predictions_from_news(p)
    assert len(out) == 1
    body = out[0]["body"]
    assert "line1" in body and "line2" in body
    # Leading indent on each line is stripped — no body line starts with spaces.
    for line in body.splitlines():
        if line:
            assert not line.startswith(" "), f"unstripped indent: {line!r}"


# ---------------------------------------------------------------------------
# Task 4: extract_validation_rows_from_fp
#
# Real markdown shape:
#
#   ## Validation findings
#
#   | Prediction (summary) | Prediction date | Today's relevance | Evidence summary | Reference link(s) |
#   |---|---|---|---|---|
#   | <prose label> | YYYY-MM-DD | <int> | <int or prose> | [label1](url1), [label2](url2) |
#   ...
#
#   ## Bridge
#
# Col 4 ("Evidence summary") in the legacy markdown is often an integer
# count rather than a prose string — the sub-agent regenerates this
# field fresh, so the extractor stores whatever's in the cell verbatim.
# ---------------------------------------------------------------------------


def test_extract_validation_rows_from_fp_real_format(tmp_path):
    md = (
        "# Future Prediction Validation Report 2026-05-04\n\n"
        "Coverage window: predictions from 2026-04-27 through 2026-05-03.\n\n"
        "## Validation findings\n\n"
        "| Prediction (summary) | Prediction date | Today's relevance | "
        "Evidence summary | Reference link(s) |\n"
        "|---|---|---|---|---|\n"
        "| Mag 7 Q1 earnings reset AI-capex narrative | 2026-04-27 | 5 | 4 | "
        "[Computing.net - AMD Q1](https://computing.net/x), "
        "[TipRanks AMD](https://tipranks.com/y) |\n"
        "| AI-Infra CVE class graduates | 2026-04-27 | 3 | 4 | "
        "[Stellar Cyber](https://stellarcyber.ai/learn) |\n\n"
        "## Bridge\n\n"
        "(prose follows...)\n"
    )
    p = tmp_path / "future-prediction-20260504.md"
    p.write_text(md, encoding="utf-8")
    out = sb.extract_validation_rows_from_fp(p)
    assert len(out) == 2
    r0 = out[0]
    assert (
        r0["prediction_ref"]["short_label"]
        == "Mag 7 Q1 earnings reset AI-capex narrative"
    )
    assert r0["prediction_ref"]["prediction_date"] == "2026-04-27"
    assert r0["today_relevance"] == 5
    assert len(r0["reference_links"]) == 2
    assert r0["reference_links"][0]["label"] == "Computing.net - AMD Q1"
    assert r0["reference_links"][0]["url"] == "https://computing.net/x"
    assert r0["reference_links"][1]["url"] == "https://tipranks.com/y"
    # Second row, single reference link.
    assert out[1]["today_relevance"] == 3
    assert len(out[1]["reference_links"]) == 1


def test_extract_validation_rows_no_section(tmp_path):
    p = tmp_path / "future-prediction-20260419.md"
    p.write_text("# FP report\n\nNo validation findings section.\n", encoding="utf-8")
    assert sb.extract_validation_rows_from_fp(p) == []


def test_extract_validation_rows_skips_malformed_rows(tmp_path):
    md = (
        "## Validation findings\n\n"
        "| Prediction | Date | Relevance | Summary | Links |\n"
        "|---|---|---|---|---|\n"
        "| Good row | 2026-04-27 | 4 | x | [a](https://x) |\n"
        "| Too few cells | 2026-04-27 | 5 |\n"
        "## Bridge\n"
    )
    p = tmp_path / "future-prediction-20260504.md"
    p.write_text(md, encoding="utf-8")
    out = sb.extract_validation_rows_from_fp(p)
    assert len(out) == 1
    assert out[0]["prediction_ref"]["short_label"] == "Good row"


# ---------------------------------------------------------------------------
# Task 5: prior_predictions_window + prepare_context
# ---------------------------------------------------------------------------


def test_prior_predictions_window_reads_prior_sourcedata(tmp_path):
    """Returns predictions from app/sourcedata/<prior>/predictions.json
    for up to N days before date_iso."""
    import json
    base = tmp_path / "app/sourcedata/2026-04-22"
    base.mkdir(parents=True)
    (base / "predictions.json").write_text(
        json.dumps({
            "date": "2026-04-22",
            "predictions": [
                {
                    "id": "prediction.aaaa1111bbbb2222",
                    "title": "T1",
                    "body": "B1",
                    "reasoning": {
                        "because": "x", "given": "y", "so_that": "z",
                        "landing": "by Q4", "plain_language": "kid",
                    },
                    "summary": "S1",
                }
            ],
        }),
        encoding="utf-8",
    )
    out = sb.prior_predictions_window(tmp_path, "2026-04-23", n=7)
    assert len(out) == 1
    assert out[0]["id"] == "prediction.aaaa1111bbbb2222"
    assert out[0]["prediction_date"] == "2026-04-22"
    assert out[0]["title"] == "T1"


def test_prior_predictions_window_empty_when_no_prior(tmp_path):
    out = sb.prior_predictions_window(tmp_path, "2026-04-22", n=7)
    assert out == []


def test_prepare_context_bundles_predictions_validation_rows_and_prior(tmp_path):
    """Day-1: news only. Day-2: news + FP referencing day-1."""
    (tmp_path / "report/en").mkdir(parents=True)
    (tmp_path / "future-prediction/en").mkdir(parents=True)
    (tmp_path / "report/en/news-20260422.md").write_text(
        "## Future\n\n1. P1\n\n   Body1.\n\n2. P2\n\n   Body2.\n\n## Change Log\n",
        encoding="utf-8",
    )
    (tmp_path / "report/en/news-20260423.md").write_text(
        "## Future\n\n1. P3\n\n   Body3.\n\n## Change Log\n",
        encoding="utf-8",
    )
    (tmp_path / "future-prediction/en/future-prediction-20260423.md").write_text(
        "## Validation findings\n\n"
        "| Prediction (summary) | Prediction date | Today's relevance | "
        "Evidence summary | Reference link(s) |\n"
        "|---|---|---|---|---|\n"
        "| P1 | 2026-04-22 | 4 | x | [a](https://x) |\n",
        encoding="utf-8",
    )
    b1 = sb.prepare_context(tmp_path, "2026-04-22")
    assert b1["date"] == "2026-04-22"
    assert len(b1["predictions_to_compose"]) == 2
    assert b1["validation_rows_to_bridge"] == []
    assert b1["prior_predictions"] == []

    b2 = sb.prepare_context(tmp_path, "2026-04-23")
    assert len(b2["predictions_to_compose"]) == 1
    assert b2["predictions_to_compose"][0]["title"] == "P3"
    assert len(b2["validation_rows_to_bridge"]) == 1
    assert b2["validation_rows_to_bridge"][0]["prediction_ref"]["short_label"] == "P1"
    assert b2["prior_predictions"] == []  # Sourcedata for day-1 not yet populated.


# ---------------------------------------------------------------------------
# Task 6: apply_predictions / apply_bridges / apply_needs
# ---------------------------------------------------------------------------


def test_apply_predictions_writes_atomically(tmp_path):
    payload = _valid_predictions_payload()
    out = sb.apply_predictions(tmp_path, "2026-04-22", payload)
    assert out == tmp_path / "app/sourcedata/2026-04-22/predictions.json"
    loaded = json.loads(out.read_text(encoding="utf-8"))
    assert loaded == payload


def test_apply_predictions_rejects_invalid_schema(tmp_path):
    bad = {"date": "2026-04-22", "predictions": [{"id": "x"}]}
    with pytest.raises(SourcedataValidationError):
        sb.apply_predictions(tmp_path, "2026-04-22", bad)
    # No file should be created on validation failure.
    assert not (tmp_path / "app/sourcedata/2026-04-22/predictions.json").exists()


def test_apply_bridges_round_trip(tmp_path):
    payload = {
        "date": "2026-04-23",
        "validation_rows": [
            {
                "prediction_ref": {
                    "id": "prediction.aaaa1111bbbb2222",
                    "short_label": "Test prediction",
                    "prediction_date": "2026-04-22",
                },
                "today_relevance": 4,
                "evidence_summary": "Some evidence.",
                "reference_links": [{"label": "src", "url": "https://x"}],
                "bridge": {
                    "support_dimension": "given",
                    "narrative": "Today supports the given premise.",
                    "coherence": 4,
                    "remaining_gap": "Need a confirming earnings call.",
                },
            }
        ],
    }
    out = sb.apply_bridges(tmp_path, "2026-04-23", payload)
    assert out == tmp_path / "app/sourcedata/2026-04-23/bridges.json"
    assert json.loads(out.read_text(encoding="utf-8")) == payload


def test_apply_needs_round_trip(tmp_path):
    payload = {
        "date": "2026-04-22",
        "by_prediction": {
            "prediction.aaaa1111bbbb2222": [
                {
                    "actor": "PM",
                    "job": "ship feature",
                    "task": {
                        "who": "team",
                        "what": "build",
                        "where": "repo",
                        "when": "May",
                        "why": "growth",
                        "how": "agile",
                    },
                }
            ]
        },
    }
    out = sb.apply_needs(tmp_path, "2026-04-22", payload)
    assert out == tmp_path / "app/sourcedata/2026-04-22/needs.json"
    assert json.loads(out.read_text(encoding="utf-8")) == payload


def test_apply_predictions_overwrites_existing_file(tmp_path):
    """Atomic re-apply replaces a previously-written predictions.json."""
    payload1 = _valid_predictions_payload()
    sb.apply_predictions(tmp_path, "2026-04-22", payload1)
    payload2 = _valid_predictions_payload()
    payload2["predictions"][0]["title"] = "Updated title"
    sb.apply_predictions(tmp_path, "2026-04-22", payload2)
    loaded = json.loads(
        (tmp_path / "app/sourcedata/2026-04-22/predictions.json").read_text(
            encoding="utf-8"
        )
    )
    assert loaded["predictions"][0]["title"] == "Updated title"


# ---------------------------------------------------------------------------
# Task 7: apply_locale
# ---------------------------------------------------------------------------


def test_apply_locale_writes_to_locales_subdir(tmp_path):
    payload = _valid_predictions_payload()
    out = sb.apply_locale(tmp_path, "2026-04-22", "ja", "predictions", payload)
    assert out == tmp_path / "app/sourcedata/locales/2026-04-22/ja/predictions.json"
    assert json.loads(out.read_text(encoding="utf-8")) == payload


def test_apply_locale_handles_all_three_locales(tmp_path):
    payload = _valid_predictions_payload()
    for loc in ("ja", "es", "fil"):
        out = sb.apply_locale(tmp_path, "2026-04-22", loc, "predictions", payload)
        assert out.parent.name == loc


def test_apply_locale_rejects_unknown_stream(tmp_path):
    with pytest.raises(ValueError, match="unknown stream"):
        sb.apply_locale(
            tmp_path, "2026-04-22", "ja", "headlines", {"date": "2026-04-22"}
        )


def test_apply_locale_rejects_unknown_locale(tmp_path):
    with pytest.raises(ValueError, match="unknown locale"):
        sb.apply_locale(
            tmp_path, "2026-04-22", "de", "predictions", _valid_predictions_payload()
        )


def test_apply_locale_validates_schema(tmp_path):
    bad = {"date": "2026-04-22", "predictions": [{"id": "x"}]}
    with pytest.raises(SourcedataValidationError):
        sb.apply_locale(tmp_path, "2026-04-22", "ja", "predictions", bad)


# ---------------------------------------------------------------------------
# Task 8: commit_day
# ---------------------------------------------------------------------------


def test_commit_day_ingests_predictions_into_db(fake_repo, conn):
    """After apply_predictions + commit_day, the DB has the row."""
    payload = _valid_predictions_payload(date_iso="2026-04-22")
    sb.apply_predictions(fake_repo, "2026-04-22", payload)
    summary = sb.commit_day(conn, fake_repo, "2026-04-22")
    assert summary["date"] == "2026-04-22"
    assert summary["predictions"] == 1
    n = conn.execute("SELECT COUNT(*) AS n FROM predictions").fetchone()["n"]
    assert n == 1
    title = conn.execute(
        "SELECT title FROM predictions WHERE prediction_date = ?",
        ("2026-04-22",),
    ).fetchone()["title"]
    assert title == "Test prediction"


def test_commit_day_no_sourcedata_returns_zero_summary(fake_repo, conn):
    """Calling commit_day for a date without sourcedata is a safe no-op."""
    summary = sb.commit_day(conn, fake_repo, "2026-04-22")
    assert summary["date"] == "2026-04-22"
    assert summary["predictions"] == 0
    assert summary["needs"] == 0
    assert summary["bridges"] == 0


def test_commit_day_includes_locale_summary(fake_repo, conn):
    payload = _valid_predictions_payload(date_iso="2026-04-22")
    sb.apply_predictions(fake_repo, "2026-04-22", payload)
    sb.apply_locale(fake_repo, "2026-04-22", "ja", "predictions", payload)
    summary = sb.commit_day(conn, fake_repo, "2026-04-22")
    assert "locales" in summary
    ja = summary["locales"].get("ja", {})
    assert ja.get("predictions", 0) == 1


# ---------------------------------------------------------------------------
# Task 9: CLI surface (scan / prepare / apply)
# ---------------------------------------------------------------------------


def test_cli_scan_outputs_json(tmp_path):
    import subprocess
    import sys

    (tmp_path / "report/en").mkdir(parents=True)
    (tmp_path / "report/en/news-20260419.md").write_text("x", encoding="utf-8")
    proc = subprocess.run(
        [
            sys.executable,
            "-m",
            "app.skills.super_backfill",
            "--repo-root",
            str(tmp_path),
            "scan",
        ],
        cwd=str(REPO_ROOT_REAL),
        capture_output=True,
        text=True,
        check=True,
    )
    out = json.loads(proc.stdout)
    assert out == [["2026-04-19", True, False]]


def test_cli_prepare_outputs_context_bundle(tmp_path):
    import subprocess
    import sys

    (tmp_path / "report/en").mkdir(parents=True)
    (tmp_path / "report/en/news-20260419.md").write_text(
        "## Future\n\n1. Title One\n\n   Body content.\n\n## Change Log\n",
        encoding="utf-8",
    )
    proc = subprocess.run(
        [
            sys.executable,
            "-m",
            "app.skills.super_backfill",
            "--repo-root",
            str(tmp_path),
            "prepare",
            "--date",
            "2026-04-19",
        ],
        cwd=str(REPO_ROOT_REAL),
        capture_output=True,
        text=True,
        check=True,
    )
    bundle = json.loads(proc.stdout)
    assert bundle["date"] == "2026-04-19"
    assert len(bundle["predictions_to_compose"]) == 1
    assert bundle["predictions_to_compose"][0]["title"] == "Title One"


def test_cli_apply_predictions_writes_file(tmp_path):
    import subprocess
    import sys

    payload = _valid_predictions_payload(date_iso="2026-04-22")
    json_in = tmp_path / "preds.json"
    json_in.write_text(json.dumps(payload), encoding="utf-8")
    proc = subprocess.run(
        [
            sys.executable,
            "-m",
            "app.skills.super_backfill",
            "--repo-root",
            str(tmp_path),
            "apply",
            "--date",
            "2026-04-22",
            "--stream",
            "predictions",
            "--json-file",
            str(json_in),
        ],
        cwd=str(REPO_ROOT_REAL),
        capture_output=True,
        text=True,
        check=True,
    )
    assert proc.stdout.startswith("OK ")
    out_path = tmp_path / "app/sourcedata/2026-04-22/predictions.json"
    assert out_path.is_file()
    assert json.loads(out_path.read_text(encoding="utf-8")) == payload


def test_cli_apply_locale_writes_to_locales_subdir(tmp_path):
    import subprocess
    import sys

    payload = _valid_predictions_payload(date_iso="2026-04-22")
    json_in = tmp_path / "preds.ja.json"
    json_in.write_text(json.dumps(payload), encoding="utf-8")
    proc = subprocess.run(
        [
            sys.executable,
            "-m",
            "app.skills.super_backfill",
            "--repo-root",
            str(tmp_path),
            "apply",
            "--date",
            "2026-04-22",
            "--stream",
            "predictions",
            "--locale",
            "ja",
            "--json-file",
            str(json_in),
        ],
        cwd=str(REPO_ROOT_REAL),
        capture_output=True,
        text=True,
        check=True,
    )
    out_path = tmp_path / "app/sourcedata/locales/2026-04-22/ja/predictions.json"
    assert out_path.is_file()
