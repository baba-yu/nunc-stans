"""Retention for the reader-facing dashboard snapshots under ``docs/data/snapshots/``.

The weekly flow writes a new ``docs/data/snapshots/<YYYYMMDD>/`` each Sunday.
Only the most recent ``keep`` weeks should ship to GitHub Pages: the Pages
artifact is ``tar(./docs)``, so every retained snapshot (~70 MB) inflates it,
and past ~100 MB the Pages ``syncing_files`` step starts failing.

Older snapshots are **not deleted** — they are *moved* to
``docs/archives/snapshots/<YYYYMMDD>/``. That directory is gitignored, so the
archived weeks survive on the local machine but never reach the repo, a fresh
CI checkout, or the Pages artifact. ``index.json`` is regenerated to list
exactly the retained dates (its ``default`` field is preserved).

Deterministic + idempotent — safe to run every week. This replaces the previous
agent-executed "5-week retention" step, which regenerated ``index.json`` but
left the old directories on disk; they accumulated to 11 weeks / ~550 MB and
broke the Pages deploy.

Usage (from the repo root)::

    python -m app.skills.archive_snapshots            # keep 5, archive the rest
    python -m app.skills.archive_snapshots --dry-run  # show the plan only
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from pathlib import Path

_DATE_RE = re.compile(r"^\d{8}$")
DEFAULT_KEEP = 5


def snapshot_dates(snapshots_dir: Path) -> list[str]:
    """Return the ``YYYYMMDD`` directory names directly under ``snapshots_dir``, sorted ascending."""
    if not snapshots_dir.is_dir():
        return []
    return sorted(
        p.name
        for p in snapshots_dir.iterdir()
        if p.is_dir() and _DATE_RE.match(p.name)
    )


def plan_retention(dates: list[str], keep: int) -> tuple[list[str], list[str]]:
    """Split ``dates`` (sorted ascending) into ``(retained, to_archive)``.

    Keeps the ``keep`` most-recent dates. ``keep <= 0`` archives everything;
    ``keep >= len(dates)`` archives nothing.
    """
    if keep <= 0:
        return [], list(dates)
    if len(dates) <= keep:
        return list(dates), []
    return dates[-keep:], dates[:-keep]


def _read_index_default(snapshots_dir: Path, fallback: str = "live") -> str:
    """Preserve the existing ``index.json`` ``default`` field across regeneration."""
    idx = snapshots_dir / "index.json"
    try:
        obj = json.loads(idx.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return fallback
    default = obj.get("default") if isinstance(obj, dict) else None
    return default if isinstance(default, str) and default else fallback


def write_index(snapshots_dir: Path, retained: list[str], default: str) -> None:
    """Rewrite ``index.json`` to list exactly ``retained`` (matching the on-disk 2-space form)."""
    idx = snapshots_dir / "index.json"
    payload = {"snapshots": retained, "default": default}
    idx.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def archive_snapshots(
    snapshots_dir: Path,
    archive_dir: Path,
    keep: int = DEFAULT_KEEP,
) -> tuple[list[str], list[str]]:
    """Move aged-out snapshot dirs to ``archive_dir`` and regenerate ``index.json``.

    Returns ``(retained, archived)``. Idempotent: a second run with no new
    snapshots archives nothing. If an archive destination already exists (a
    prior partial run), it is replaced so the move cannot fail.
    """
    dates = snapshot_dates(snapshots_dir)
    retained, to_archive = plan_retention(dates, keep)
    if to_archive:
        archive_dir.mkdir(parents=True, exist_ok=True)
        for date in to_archive:
            src = snapshots_dir / date
            dst = archive_dir / date
            if dst.exists():
                shutil.rmtree(dst)
            shutil.move(str(src), str(dst))
    # Only (re)generate index.json when the snapshots dir actually exists —
    # never conjure it (and an empty index) for a missing directory.
    if snapshots_dir.is_dir():
        write_index(snapshots_dir, retained, _read_index_default(snapshots_dir))
    return retained, to_archive


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        description="Archive aged-out dashboard snapshots out of docs/data/snapshots/ (keep the most recent, move the rest to a gitignored archive)."
    )
    p.add_argument("--snapshots-dir", type=Path, default=Path("docs/data/snapshots"))
    p.add_argument("--archive-dir", type=Path, default=Path("docs/archives/snapshots"))
    p.add_argument("--keep", type=int, default=DEFAULT_KEEP, help="how many most-recent weeks to keep published (default: 5)")
    p.add_argument("--dry-run", action="store_true", help="print the plan without moving anything")
    args = p.parse_args(argv)

    if args.keep < 1:
        print("FAIL --keep must be >= 1 (refusing to archive every snapshot)", file=sys.stderr)
        return 2

    dates = snapshot_dates(args.snapshots_dir)
    retained, to_archive = plan_retention(dates, args.keep)
    print(f"{args.snapshots_dir}: {len(dates)} snapshot(s); keep {args.keep} -> retain {len(retained)}, archive {len(to_archive)}")
    if to_archive:
        print("  archive -> " + str(args.archive_dir) + ": " + ", ".join(to_archive))
        print("  retain: " + ", ".join(retained))

    if args.dry_run:
        print("dry-run: no changes written.")
        return 0

    retained, archived = archive_snapshots(args.snapshots_dir, args.archive_dir, args.keep)
    print(f"Done. Retained {len(retained)} in {args.snapshots_dir}; archived {len(archived)} to {args.archive_dir}; index.json regenerated.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
