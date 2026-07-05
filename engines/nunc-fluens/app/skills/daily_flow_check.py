"""Daily flow completion check — universal "is today done?" gate.

Spec: ``design/skills/daily-flow-check.md``.

Wraps the day-of-week branching from ``design/scheduled/0_daily_master.md``
into a single CLI that enumerates every required artifact for the date,
checks each one, and exits 0 (all green) or 1 (anything missing).

Use this as:

  * pre-flight (``--report-missing``) to enumerate gaps before re-running
  * post-flight (``--strict``) to gate any "complete" / push claim

Phase 4b's redo surfaced the gap — see the "Why this exists" note in
``0_daily_master.md``. Without this gate, an agent driving the day
silently misses the Sunday-only tasks (4_weekly_memory + 5_weekly_theme_review)
and the daily-briefing chain (3_daily_briefing).

What "today done" means (the 5 buckets):

  1. **News + FP markdown files** in all 4 locales (en/ja/es/fil) for today.
  2. **Database population** for today via ``post_update_validation``
     (check news + future-prediction + exports).
  3. **Sunday-only artifacts** (if ``--date`` is a Sunday):
       - ``memory/dormant/dormant-YYYYMMDD.md``
       - ``memory/theme-review/theme-review-YYYYMMDD.md``
       - ``memory/snapshots/<YYYYMMDD>-pre-review/`` (with schema.sql + 3
         graph JSONs + manifest)
       - ``docs/data/snapshots/<YYYYMMDD>/`` (with 3 graph JSONs +
         manifest), listed in ``docs/data/snapshots/index.json``
  4. **READMEs**: 3-day window including today across all 4 locales.
  5. **Dashboard hygiene**: ``docs/data/manifest.json`` shape, dashboard
     asset endings, SQLite PRAGMA integrity.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sqlite3
import subprocess
import sys
from pathlib import Path

LOCALES = ("en", "ja", "es", "fil")


def _is_sunday(date: str) -> bool:
    return dt.date.fromisoformat(date).isoweekday() == 7


def _stem(date: str) -> str:
    return date.replace("-", "")


# ---------------------------------------------------------------------------
# Bucket 1: news + FP markdown files
# ---------------------------------------------------------------------------


def _check_files(repo_root: Path, date: str) -> list[str]:
    errs: list[str] = []
    for kind, sub in (("news", "report"), ("future-prediction", "future-prediction")):
        stem = f"{kind}-{_stem(date)}"
        for loc in LOCALES:
            p = repo_root / sub / loc / f"{stem}.md"
            if not p.is_file():
                errs.append(f"missing: {p.relative_to(repo_root)}")
            elif p.stat().st_size == 0:
                errs.append(f"empty: {p.relative_to(repo_root)}")
    return errs


# ---------------------------------------------------------------------------
# Bucket 2: post_update_validation
# ---------------------------------------------------------------------------


def _check_db_population(repo_root: Path, date: str) -> list[str]:
    """Delegate to the existing post_update_validation skill."""
    cmd = [
        sys.executable, "-m", "app.skills.post_update_validation",
        "--check", "all",
        "--date", date,
        "--db", str(repo_root / "app/data/analytics.sqlite"),
        "--docs-data-dir", str(repo_root / "docs/data"),
        "--repo-root", str(repo_root),
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, cwd=str(repo_root))
    errs: list[str] = []
    if res.returncode != 0:
        # Surface the FAIL lines from post_update_validation's stdout
        for line in res.stdout.splitlines():
            if line.startswith("FAIL"):
                errs.append(f"post_update_validation: {line}")
        if not errs:
            errs.append(
                f"post_update_validation exited {res.returncode} but produced no FAIL lines; "
                f"stderr={res.stderr[:200]!r}"
            )
    return errs


# ---------------------------------------------------------------------------
# Bucket 3: Sunday-only artifacts
# ---------------------------------------------------------------------------


def _check_sunday_artifacts(repo_root: Path, date: str) -> list[str]:
    if not _is_sunday(date):
        return []
    errs: list[str] = []
    stem = _stem(date)
    # 4_weekly_memory: dormant snapshot
    dormant = repo_root / "memory/dormant" / f"dormant-{stem}.md"
    if not dormant.is_file():
        errs.append(
            f"missing Sunday artifact: {dormant.relative_to(repo_root)} "
            f"(4_weekly_memory Step 5 did not run)"
        )
    # 5_weekly_theme_review: theme review proposal
    review = repo_root / "memory/theme-review" / f"theme-review-{stem}.md"
    if not review.is_file():
        errs.append(
            f"missing Sunday artifact: {review.relative_to(repo_root)} "
            f"(5_weekly_theme_review Step 5 did not run)"
        )
    # 5_weekly_theme_review Step 2: pre-review rollback snapshot
    pre_review = repo_root / "memory/snapshots" / f"{stem}-pre-review"
    if not pre_review.is_dir():
        errs.append(
            f"missing Sunday artifact: {pre_review.relative_to(repo_root)}/ "
            f"(5_weekly_theme_review Step 2 did not snapshot rollback target)"
        )
    else:
        for required in ("schema.sql", "graph-tech.json", "graph-business.json",
                         "graph-mix.json", "manifest.json"):
            if not (pre_review / required).is_file():
                errs.append(
                    f"missing in pre-review snapshot: "
                    f"{pre_review.relative_to(repo_root)}/{required}"
                )
    # 5_weekly_theme_review Step 2: dashboard-facing snapshot
    dashboard_snap = repo_root / "docs/data/snapshots" / stem
    if not dashboard_snap.is_dir():
        errs.append(
            f"missing Sunday artifact: {dashboard_snap.relative_to(repo_root)}/ "
            f"(5_weekly_theme_review Step 2 did not snapshot reader-facing dashboard)"
        )
    else:
        for required in ("graph-tech.json", "graph-business.json",
                         "graph-mix.json", "manifest.json"):
            if not (dashboard_snap / required).is_file():
                errs.append(
                    f"missing in dashboard snapshot: "
                    f"{dashboard_snap.relative_to(repo_root)}/{required}"
                )
    # docs/data/snapshots/index.json must list today's snapshot dir
    index = repo_root / "docs/data/snapshots/index.json"
    if not index.is_file():
        errs.append(f"missing: {index.relative_to(repo_root)}")
    else:
        try:
            idx = json.loads(index.read_text(encoding="utf-8"))
            if stem not in (idx.get("snapshots") or []):
                errs.append(
                    f"docs/data/snapshots/index.json does not list {stem!r} "
                    f"(SNAP dropdown will not surface today's snapshot)"
                )
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            errs.append(f"docs/data/snapshots/index.json invalid: {e}")
    return errs


# ---------------------------------------------------------------------------
# Bucket 4: READMEs (3-day window including today)
# ---------------------------------------------------------------------------


def _check_readmes(repo_root: Path, date: str) -> list[str]:
    errs: list[str] = []
    expected_dates = sorted(
        (dt.date.fromisoformat(date) - dt.timedelta(days=i)).isoformat()
        for i in range(3)
    )
    for loc in ("", ".ja", ".es", ".fil"):
        path = repo_root / f"README{loc}.md"
        if not path.is_file():
            errs.append(f"missing: {path.relative_to(repo_root)}")
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            errs.append(f"{path.relative_to(repo_root)}: not valid UTF-8")
            continue
        # Required: today's date as ## YYYY-MM-DD header
        if not re.search(rf"^## {re.escape(date)}\s*$", text, re.MULTILINE):
            errs.append(
                f"{path.relative_to(repo_root)}: missing `## {date}` header "
                f"(3_daily_briefing Step 2 did not include today)"
            )
        # Required: exactly 3 ## YYYY-MM-DD headers, matching the 3-day window
        headers = re.findall(r"^## (\d{4}-\d{2}-\d{2})\s*$", text, re.MULTILINE)
        if len(headers) != 3:
            errs.append(
                f"{path.relative_to(repo_root)}: has {len(headers)} `## YYYY-MM-DD` "
                f"headers, expected 3 (window: {expected_dates})"
            )
        else:
            actual = sorted(headers)
            if actual != expected_dates:
                errs.append(
                    f"{path.relative_to(repo_root)}: window is {actual}, "
                    f"expected {expected_dates}"
                )
        # Required: the today-block links to the locale-specific news + FP file
        loc_seg = "en" if loc == "" else loc.lstrip(".")
        for kind, sub in (("news", "report"),
                          ("future-prediction", "future-prediction")):
            link = f"[{kind}-{_stem(date)}.md]({sub}/{loc_seg}/{kind}-{_stem(date)}.md)"
            if link not in text:
                errs.append(
                    f"{path.relative_to(repo_root)}: missing today's link "
                    f"`{link}` (locale-link routing rule)"
                )
    return errs


# ---------------------------------------------------------------------------
# Bucket 5: dashboard hygiene
# ---------------------------------------------------------------------------


def _check_dashboard_hygiene(repo_root: Path) -> list[str]:
    errs: list[str] = []
    # manifest.json shape
    m_path = repo_root / "docs/data/manifest.json"
    if not m_path.is_file():
        errs.append(f"missing: {m_path.relative_to(repo_root)}")
    else:
        try:
            m = json.loads(m_path.read_text(encoding="utf-8"))
            if len((m.get("locales") or [])) != 4:
                errs.append(
                    f"docs/data/manifest.json has "
                    f"{len(m.get('locales') or [])} locales, expected 4"
                )
            if m.get("default_locale") != "en":
                errs.append(
                    f"docs/data/manifest.json default_locale="
                    f"{m.get('default_locale')!r}, expected 'en'"
                )
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            errs.append(f"docs/data/manifest.json invalid: {e}")
    # dashboard asset endings (the post-write-integrity dashboard-asset rule)
    for rel, tail_re in (
        ("docs/index.html", r"</html>\s*$"),
        ("docs/assets/app.js", r"\}\)\(\);?\s*$"),
        ("docs/assets/styles.css", r"\}\s*$"),
    ):
        p = repo_root / rel
        if not p.is_file():
            errs.append(f"missing: {rel}")
            continue
        try:
            txt = p.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            errs.append(f"{rel}: not valid UTF-8")
            continue
        if not re.search(tail_re, txt):
            errs.append(f"{rel}: tail does not match /{tail_re}/")
    # SQLite PRAGMA integrity_check
    db = repo_root / "app/data/analytics.sqlite"
    if not db.is_file():
        errs.append(f"missing: {db.relative_to(repo_root)}")
    else:
        try:
            conn = sqlite3.connect(db)
            row = conn.execute("PRAGMA integrity_check").fetchone()
            conn.close()
            if (row or [None])[0] != "ok":
                errs.append(f"sqlite PRAGMA integrity_check: {row}")
        except sqlite3.Error as e:
            errs.append(f"sqlite PRAGMA integrity_check raised: {e}")
    return errs


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------


def _run(name: str, errs: list[str]) -> bool:
    if errs:
        print(f"FAIL {name}: {len(errs)} issue(s)")
        for e in errs:
            print(f"  - {e}")
        return False
    print(f"OK {name}")
    return True


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        description="Universal 'is today's scheduled flow done?' gate"
    )
    p.add_argument("--date", default=dt.date.today().isoformat())
    p.add_argument(
        "--repo-root", default=Path("."), type=Path,
        help="repo root containing app/ docs/ memory/ report/ future-prediction/"
    )
    mode = p.add_mutually_exclusive_group()
    mode.add_argument(
        "--strict", action="store_true",
        help="exit non-zero on any missing artifact (default behavior)"
    )
    mode.add_argument(
        "--report-missing", action="store_true",
        help="report only — always exit 0 (use as pre-flight survey)"
    )
    args = p.parse_args(argv)

    root = args.repo_root.resolve()
    is_sun = _is_sunday(args.date)
    print(f"daily-flow-check :: date={args.date} ({'Sun' if is_sun else 'Mon-Sat'})")
    print(f"  repo-root: {root}")
    print()
    all_pass = True
    all_pass &= _run(
        f"news+FP markdown files ({args.date})",
        _check_files(root, args.date),
    )
    all_pass &= _run(
        f"DB population via post_update_validation ({args.date})",
        _check_db_population(root, args.date),
    )
    if is_sun:
        all_pass &= _run(
            f"Sunday artifacts (dormant + theme-review + snapshots) ({args.date})",
            _check_sunday_artifacts(root, args.date),
        )
    all_pass &= _run(
        f"READMEs (3-day window including {args.date})",
        _check_readmes(root, args.date),
    )
    all_pass &= _run(
        "dashboard hygiene (manifest + assets + sqlite)",
        _check_dashboard_hygiene(root),
    )
    print()
    if all_pass:
        print("ALL GREEN — today is done")
    else:
        print("NOT DONE — see FAIL lines above")
    if args.report_missing:
        return 0
    return 0 if all_pass else 1


if __name__ == "__main__":
    sys.exit(main())
