"""Run update_pages.bat (or its CLI equivalent) with the standard fallback.

Spec: ``design/skills/run-update-pages-bat.md``.

Cross-platform: invokes ``app/update_pages.bat`` on Windows, falls back
to ``python -m src.cli update`` on Unix-likes (the bat is just a wrapper
around the same CLI). Recovery: on a malformed/locked sqlite, remove the
DB file and retry once.
"""

from __future__ import annotations

import argparse
import os
import platform
import sqlite3
import subprocess
import sys
from pathlib import Path


DB_PATH = Path("app/data/analytics.sqlite")


def _run_update() -> tuple[int, str]:
    if platform.system() == "Windows":
        cmd: list[str] = ["app/update_pages.bat"]
        shell = True
    else:
        cmd = [sys.executable, "-m", "src.cli", "update"]
        shell = False
    proc = subprocess.run(
        cmd,
        cwd="app" if not (platform.system() == "Windows") else None,
        shell=shell,
        capture_output=True,
        text=True,
    )
    return proc.returncode, (proc.stdout or "") + (proc.stderr or "")


def _integrity_ok() -> bool:
    if not DB_PATH.is_file():
        return False
    try:
        conn = sqlite3.connect(DB_PATH)
        try:
            row = conn.execute("PRAGMA integrity_check").fetchone()
        finally:
            conn.close()
    except sqlite3.Error:
        return False
    return bool(row) and row[0] == "ok"


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Run update_pages with sqlite + pytest sanity")
    p.add_argument("--skip-pytest", action="store_true",
                   help="Skip the post-run pytest pass (faster CI)")
    args = p.parse_args(argv)

    rc, output = _run_update()
    if rc != 0:
        print(output)
        if "database disk image is malformed" in output or "database is locked" in output.lower():
            print("[run-update-pages] retry: removing analytics.sqlite and re-running…")
            try:
                DB_PATH.unlink()
            except FileNotFoundError:
                pass
            rc, output = _run_update()
            print(output)
        if rc != 0:
            print("FAIL update_pages did not converge after recovery", file=sys.stderr)
            return 1
    else:
        print(output)

    if not _integrity_ok():
        print("FAIL post-run sqlite PRAGMA integrity_check", file=sys.stderr)
        return 1

    if not args.skip_pytest:
        proc = subprocess.run(
            [sys.executable, "-m", "pytest", "-q"],
            cwd="app",
            capture_output=True,
            text=True,
        )
        if proc.returncode != 0:
            print(proc.stdout)
            print(proc.stderr, file=sys.stderr)
            print("FAIL post-run pytest", file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
