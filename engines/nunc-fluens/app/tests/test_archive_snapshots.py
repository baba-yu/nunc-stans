"""Tests for archive_snapshots retention (keep latest N, move older to gitignored archive)."""

from __future__ import annotations

import json
from pathlib import Path

from app.skills.archive_snapshots import (
    archive_snapshots,
    plan_retention,
    snapshot_dates,
    write_index,
)


def _make_snapshot(snapshots_dir: Path, date: str) -> None:
    d = snapshots_dir / date
    d.mkdir(parents=True, exist_ok=True)
    # Mimic a real snapshot dir: 3 graph JSONs + manifest.
    for name in ("graph-tech.json", "graph-business.json", "graph-mix.json"):
        (d / name).write_text(f'{{"date":"{date}"}}', encoding="utf-8")
    (d / "manifest.json").write_text(f'{{"date":"{date}"}}', encoding="utf-8")


def test_plan_retention_keeps_most_recent():
    dates = ["20260503", "20260510", "20260607", "20260628", "20260705"]
    retained, to_archive = plan_retention(dates, keep=3)
    assert retained == ["20260607", "20260628", "20260705"]
    assert to_archive == ["20260503", "20260510"]


def test_plan_retention_fewer_than_keep_archives_nothing():
    dates = ["20260628", "20260705"]
    retained, to_archive = plan_retention(dates, keep=5)
    assert retained == dates
    assert to_archive == []


def test_snapshot_dates_ignores_non_date_entries(tmp_path: Path):
    snaps = tmp_path / "snapshots"
    _make_snapshot(snaps, "20260705")
    _make_snapshot(snaps, "20260628")
    (snaps / "index.json").write_text("{}", encoding="utf-8")  # file, not a dir
    (snaps / "notadate").mkdir()  # non-YYYYMMDD dir
    assert snapshot_dates(snaps) == ["20260628", "20260705"]


def test_archive_moves_old_and_regenerates_index(tmp_path: Path):
    snaps = tmp_path / "docs/data/snapshots"
    archive = tmp_path / "docs/archives/snapshots"
    dates = ["20260503", "20260505", "20260510", "20260517", "20260524",
             "20260531", "20260607", "20260614", "20260621", "20260628", "20260705"]
    for d in dates:
        _make_snapshot(snaps, d)
    # Pre-existing index with a non-default "default" to check preservation.
    write_index(snaps, dates, "live")

    retained, archived = archive_snapshots(snaps, archive, keep=5)

    assert retained == ["20260607", "20260614", "20260621", "20260628", "20260705"]
    assert archived == ["20260503", "20260505", "20260510", "20260517", "20260524", "20260531"]

    # Retained dirs stay put; archived dirs left docs/data/snapshots entirely.
    assert sorted(snapshot_dates(snaps)) == retained
    for d in archived:
        assert not (snaps / d).exists()
        assert (archive / d / "graph-mix.json").is_file()  # moved intact

    # index.json now lists exactly the retained 5, default preserved.
    idx = json.loads((snaps / "index.json").read_text(encoding="utf-8"))
    assert idx == {"snapshots": retained, "default": "live"}
    # Trailing newline + 2-space indent (matches the on-disk convention).
    raw = (snaps / "index.json").read_text(encoding="utf-8")
    assert raw.endswith("}\n")
    assert '\n  "snapshots"' in raw


def test_archive_is_idempotent(tmp_path: Path):
    snaps = tmp_path / "docs/data/snapshots"
    archive = tmp_path / "docs/archives/snapshots"
    for d in ["20260607", "20260614", "20260621", "20260628", "20260705", "20260531"]:
        _make_snapshot(snaps, d)

    first_retained, first_archived = archive_snapshots(snaps, archive, keep=5)
    assert first_archived == ["20260531"]

    # Second run: nothing new to archive, retained set unchanged.
    second_retained, second_archived = archive_snapshots(snaps, archive, keep=5)
    assert second_archived == []
    assert second_retained == first_retained
    assert (archive / "20260531").is_dir()


def test_archive_replaces_existing_destination(tmp_path: Path):
    # A prior partial run already left an archive dir for the same date; the
    # move must not fail — it replaces the stale destination.
    snaps = tmp_path / "docs/data/snapshots"
    archive = tmp_path / "docs/archives/snapshots"
    for d in ["20260531", "20260607", "20260614", "20260621", "20260628", "20260705"]:
        _make_snapshot(snaps, d)
    (archive / "20260531").mkdir(parents=True)
    (archive / "20260531" / "stale.json").write_text("old", encoding="utf-8")

    _retained, archived = archive_snapshots(snaps, archive, keep=5)
    assert archived == ["20260531"]
    # Fresh content moved in; the stale file is gone.
    assert (archive / "20260531" / "graph-mix.json").is_file()
    assert not (archive / "20260531" / "stale.json").exists()


def test_no_snapshots_dir_is_safe(tmp_path: Path):
    snaps = tmp_path / "missing"
    archive = tmp_path / "archive"
    retained, archived = archive_snapshots(snaps, archive, keep=5)
    assert retained == []
    assert archived == []
