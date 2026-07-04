"""Tests for app.skills.rename_future_titles."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest

from app.skills import rename_future_titles as rft


def test_parse_en_reply_ok():
    out = rft.parse_en_reply("OK prediction.abc123 New subject does X by Q4 2026")
    assert out == {
        "status": "OK",
        "pid": "prediction.abc123",
        "new_title": "New subject does X by Q4 2026",
    }


def test_parse_en_reply_keep():
    out = rft.parse_en_reply("KEEP prediction.abc123")
    assert out == {"status": "KEEP", "pid": "prediction.abc123", "new_title": None}


def test_parse_en_reply_fail():
    out = rft.parse_en_reply("FAIL prediction.abc123 body is empty")
    assert out == {
        "status": "FAIL",
        "pid": "prediction.abc123",
        "reason": "body is empty",
    }


def test_parse_en_reply_strips_trailing_whitespace():
    out = rft.parse_en_reply("OK prediction.abc123 Title  \n")
    assert out["new_title"] == "Title"


def test_parse_en_reply_malformed_raises():
    with pytest.raises(ValueError):
        rft.parse_en_reply("garbage")
    with pytest.raises(ValueError):
        rft.parse_en_reply("OK")
    with pytest.raises(ValueError):
        rft.parse_en_reply("KEEP prediction.abc extra-token")


def test_parse_locale_reply_ok():
    text = '```json\n{"prediction.a": "ロケール題", "prediction.b": "別の題", "prediction.c": "三題"}\n```'
    expected_pids = ["prediction.a", "prediction.b", "prediction.c"]
    out = rft.parse_locale_reply(text, expected_pids)
    assert out == {
        "prediction.a": "ロケール題",
        "prediction.b": "別の題",
        "prediction.c": "三題",
    }


def test_parse_locale_reply_no_fence():
    # Bare JSON object without code fence is also accepted.
    text = '{"prediction.a": "x", "prediction.b": "y", "prediction.c": "z"}'
    out = rft.parse_locale_reply(text, ["prediction.a", "prediction.b", "prediction.c"])
    assert out["prediction.a"] == "x"


def test_parse_locale_reply_missing_pid_raises():
    text = '{"prediction.a": "x", "prediction.b": "y"}'
    with pytest.raises(ValueError, match="missing pid"):
        rft.parse_locale_reply(text, ["prediction.a", "prediction.b", "prediction.c"])


def test_parse_locale_reply_extra_pid_raises():
    text = '{"prediction.a": "x", "prediction.b": "y", "prediction.c": "z", "prediction.d": "w"}'
    with pytest.raises(ValueError, match="unexpected pid"):
        rft.parse_locale_reply(text, ["prediction.a", "prediction.b", "prediction.c"])


def test_parse_locale_reply_non_json_raises():
    with pytest.raises(ValueError):
        rft.parse_locale_reply("not json at all", ["prediction.a"])


@pytest.fixture
def repo_root() -> Path:
    """Repo root resolved from this test file's location."""
    return Path(__file__).resolve().parents[2]


def test_scan_covers_all_dates(repo_root):
    out = rft.scan(repo_root)
    # 16 dates, but per-date prediction counts vary (3 or 4).
    # Real corpus as of 2026-05-05: 11×3 + 4×4 + 1×3 = 52.
    assert len(out) == 52
    assert {entry["date"] for entry in out} == set(rft._TARGET_DATES)
    # Every entry has the three expected keys.
    assert all({"date", "pid", "old_title"} == set(e.keys()) for e in out)
    # Every pid starts with "prediction."
    assert all(e["pid"].startswith("prediction.") for e in out)


def test_bundle_en_shape(repo_root):
    bundles = rft.bundle_en(repo_root, "2026-04-19")
    assert len(bundles) == 3
    for b in bundles:
        assert set(b.keys()) == {
            "pid", "prediction_date", "old_title", "body",
            "so_that", "landing", "title_rules"
        }
        assert b["prediction_date"] == "2026-04-19"
        assert b["pid"].startswith("prediction.")
        assert "TITLE RULES" in b["title_rules"]


def test_bundle_locale_shape(repo_root):
    bundle = rft.bundle_locale(repo_root, "2026-04-19", "ja")
    assert bundle["date"] == "2026-04-19"
    assert bundle["locale"] == "ja"
    assert len(bundle["entries"]) == 3
    for e in bundle["entries"]:
        assert set(e.keys()) == {"pid", "en_new_title", "locale_old_title"}
    assert "LOCALE TRANSLATION RULES" in bundle["locale_rules"]


def test_bundle_locale_rejects_bad_locale(repo_root):
    with pytest.raises(ValueError, match="unknown locale"):
        rft.bundle_locale(repo_root, "2026-04-19", "zz")


def _make_mock_replies(repo_root):
    """Build OK reply lines from real corpus, prefixing each old title with 'NEW: '."""
    targets = rft.scan(repo_root)
    return "\n".join(
        f"OK {t['pid']} NEW: {t['old_title']}" for t in targets
    )


def test_dry_run_idempotent(repo_root):
    replies = _make_mock_replies(repo_root)
    pinned = "2026-05-05T00:00:00+00:00"
    a = rft.assemble_dryrun(repo_root, replies, generated_at=pinned)
    b = rft.assemble_dryrun(repo_root, replies, generated_at=pinned)
    assert json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True)
    assert len(a["entries"]) == len(rft.scan(repo_root))


def test_dry_run_missing_reply_raises(repo_root):
    replies = _make_mock_replies(repo_root)
    truncated = "\n".join(replies.splitlines()[:-1])  # drop last reply
    with pytest.raises(ValueError, match="missing replies"):
        rft.assemble_dryrun(repo_root, truncated, generated_at="2026-05-05T00:00:00+00:00")


def test_dry_run_unknown_pid_raises(repo_root):
    bogus = "OK prediction.deadbeefdeadbeef New title"
    with pytest.raises(ValueError, match="unknown pid"):
        rft.assemble_dryrun(
            repo_root, bogus + "\n" + _make_mock_replies(repo_root),
            generated_at="2026-05-05T00:00:00+00:00",
        )


@pytest.fixture
def fixture_root(tmp_path, repo_root) -> Path:
    """Copy real sourcedata into an isolated tmp tree for write-tests."""
    src_app = repo_root / "app" / "sourcedata"
    dst_app = tmp_path / "app" / "sourcedata"
    shutil.copytree(src_app, dst_app)
    return tmp_path


def _build_dryrun_with_new_titles(repo_root: Path) -> dict:
    """Build a dry-run payload that prefixes every title with 'NEW: '."""
    replies = _make_mock_replies(repo_root)
    return rft.assemble_dryrun(repo_root, replies, generated_at="2026-05-05T00:00:00+00:00")


def test_apply_en_preserves_id(fixture_root):
    dryrun = _build_dryrun_with_new_titles(fixture_root)
    rft.apply_en(fixture_root, dryrun)
    # For every modified date, every prediction's ID must round-trip.
    for date_iso in rft._TARGET_DATES:
        path = fixture_root / "app" / "sourcedata" / date_iso / "predictions.json"
        payload = json.loads(path.read_text(encoding="utf-8"))
        for pred in payload["predictions"]:
            assert rft._hash_id_check(pred["id"], date_iso, pred["body"]), (
                f"ID round-trip failed: {pred['id']} on {date_iso}"
            )


def test_apply_en_preserves_summary_and_body(fixture_root, repo_root):
    """Title is mutated, but summary + body + reasoning + scope_hint are byte-identical."""
    pre = {}
    for date_iso in rft._TARGET_DATES:
        path = fixture_root / "app" / "sourcedata" / date_iso / "predictions.json"
        pre_payload = json.loads(path.read_text(encoding="utf-8"))
        for pred in pre_payload["predictions"]:
            pre[(date_iso, pred["id"])] = {
                "summary": pred["summary"], "body": pred["body"],
                "reasoning": pred["reasoning"], "scope_hint": pred["scope_hint"],
            }
    dryrun = _build_dryrun_with_new_titles(fixture_root)
    rft.apply_en(fixture_root, dryrun)
    for date_iso in rft._TARGET_DATES:
        path = fixture_root / "app" / "sourcedata" / date_iso / "predictions.json"
        post_payload = json.loads(path.read_text(encoding="utf-8"))
        for pred in post_payload["predictions"]:
            key = (date_iso, pred["id"])
            assert pred["summary"] == pre[key]["summary"]
            assert pred["body"] == pre[key]["body"]
            assert pred["reasoning"] == pre[key]["reasoning"]
            assert pred["scope_hint"] == pre[key]["scope_hint"]
            # And title HAS changed (sanity).
            assert pred["title"].startswith("NEW: ")


def test_apply_locale_one_preserves_other_fields(fixture_root):
    date_iso = "2026-04-19"
    locale = "ja"
    path = (
        fixture_root / "app" / "sourcedata" / "locales" / date_iso / locale
        / "predictions.json"
    )
    pre = json.loads(path.read_text(encoding="utf-8"))
    pre_by_pid = {p["id"]: p for p in pre["predictions"]}
    new_titles = {pid: f"新題: {pre_by_pid[pid]['title']}" for pid in pre_by_pid}
    rft.apply_locale_one(fixture_root, date_iso, locale, new_titles)
    post = json.loads(path.read_text(encoding="utf-8"))
    for p in post["predictions"]:
        assert p["title"] == new_titles[p["id"]]
        # body / reasoning / summary unchanged.
        assert p["body"] == pre_by_pid[p["id"]]["body"]
        assert p["reasoning"] == pre_by_pid[p["id"]]["reasoning"]
        assert p["summary"] == pre_by_pid[p["id"]]["summary"]


def test_rerender_uses_new_title(fixture_root):
    """Apply a new title, run render_news_md, assert it appears in the output."""
    from app.skills import render_news_md

    date_iso = "2026-04-19"
    new_title_marker = "TESTSENTINEL Subject does X by Q4 2026"
    # Build a 1-prediction dry-run that touches just the first prediction.
    targets = rft.scan(fixture_root)
    first = next(t for t in targets if t["date"] == date_iso)
    # Build replies for ALL targets (KEEP for everything except our one OK).
    lines = []
    for t in targets:
        if t["pid"] == first["pid"]:
            lines.append(f"OK {t['pid']} {new_title_marker}")
        else:
            lines.append(f"KEEP {t['pid']}")
    payload = rft.assemble_dryrun(
        fixture_root, "\n".join(lines),
        generated_at="2026-05-05T00:00:00+00:00",
    )
    rft.apply_en(fixture_root, payload)
    # Render the EN news markdown.
    md = render_news_md.render_day(str(fixture_root), date_iso, "en")
    # The new title must appear in the rendered markdown.
    assert new_title_marker in md, (
        f"new title not in rendered news markdown for {date_iso}"
    )
