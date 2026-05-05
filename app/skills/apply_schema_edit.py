"""Apply a theme-review proposal to app/src/schema.sql.

Independent skill extracted from `design/scheduled/5_weekly_theme_review.md`
Step 5. Runs in manual mode by default — proposal review must happen
before any write hits disk.

See `design/skills/apply-schema-edit.md` for the full spec.
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import sqlite3
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable


@dataclass
class Operation:
    kind: str  # 'add' | 'rewrite-description' | 'rename' | 'merge' | 'split' | 'promote-candidate' | 'log-only'
    raw_line: str
    args: dict = field(default_factory=dict)
    note: str = ""


@dataclass
class RunResult:
    applied: list[Operation] = field(default_factory=list)
    skipped: list[tuple[Operation, str]] = field(default_factory=list)
    failures: list[str] = field(default_factory=list)
    diff: str = ""


def parse_proposal(path: Path) -> list[Operation]:
    """Parse the `## Recommended actions` section into typed operations."""
    text = path.read_text(encoding="utf-8")
    m = re.search(
        r"^##\s+Recommended actions\s*$(.*?)(?=^##\s|\Z)",
        text,
        re.MULTILINE | re.DOTALL,
    )
    if not m:
        raise ValueError(f"{path}: no `## Recommended actions` section found")

    body = m.group(1)
    items = re.findall(r"^\s*\d+\.\s+(.+?)(?=^\s*\d+\.\s+|\Z)", body, re.MULTILINE | re.DOTALL)
    ops: list[Operation] = []
    for raw in items:
        flat = " ".join(line.strip() for line in raw.splitlines()).strip()
        ops.append(_classify(flat))
    return ops


_RE_ADD = re.compile(r"\bAdd\s+`?(?P<theme_id>[\w.\-_]+)`?\s+theme\s+under\s+`?(?P<category_id>[\w.\-_]+)`?", re.IGNORECASE)
_RE_RENAME = re.compile(r"\bRename\s+`?(?P<old>[\w.\-_]+)`?\s*[→\->]+\s*`?(?P<new>[\w.\-_]+)`?", re.IGNORECASE)
_RE_MERGE = re.compile(r"\bMerge\s+`?(?P<absorbed>[\w.\-_]+)`?\s+into\s+`?(?P<survivor>[\w.\-_]+)`?", re.IGNORECASE)
_RE_SPLIT = re.compile(r"\bSplit\s+`?(?P<theme_id>[\w.\-_]+)`?", re.IGNORECASE)
_RE_PROMOTE = re.compile(r"\bPromote\s+candidate\s+`?(?P<candidate_id>[\w.\-_]+)`?", re.IGNORECASE)
_RE_TIGHTEN = re.compile(r"\bTighten\s+description", re.IGNORECASE)
_RE_LOG_ONLY = re.compile(r"\b(Investigate|No\s+splits|out of scope)\b", re.IGNORECASE)


def _classify(line: str) -> Operation:
    if (m := _RE_ADD.search(line)):
        return Operation("add", line, {"theme_id": m.group("theme_id"), "category_id": m.group("category_id")})
    if (m := _RE_RENAME.search(line)):
        return Operation("rename", line, {"old_id": m.group("old"), "new_id": m.group("new")})
    if (m := _RE_MERGE.search(line)):
        return Operation("merge", line, {"absorbed_id": m.group("absorbed"), "survivor_id": m.group("survivor")})
    if (m := _RE_SPLIT.search(line)):
        return Operation("split", line, {"theme_id": m.group("theme_id")})
    if (m := _RE_PROMOTE.search(line)):
        return Operation("promote-candidate", line, {"candidate_id": m.group("candidate_id")})
    if _RE_TIGHTEN.search(line):
        # Theme list is implicit in surrounding prose; the operator must list
        # them inline. Pull `theme_id` tokens out of the line itself.
        ids = re.findall(r"`([\w.\-_]+)`", line)
        return Operation("rewrite-description", line, {"theme_ids": ids})
    if _RE_LOG_ONLY.search(line):
        return Operation("log-only", line, note="advisory; no schema edit")
    return Operation("log-only", line, note="unrecognized recommendation; skipping")


def render_plan(ops: Iterable[Operation]) -> str:
    """Human-readable plan for stdout / dry-run output."""
    out = []
    for i, op in enumerate(ops, 1):
        if op.kind == "log-only":
            out.append(f"  {i}. [log-only] {op.note}: {op.raw_line[:80]}")
        else:
            args_str = " ".join(f"{k}={v}" for k, v in op.args.items())
            out.append(f"  {i}. [{op.kind}] {args_str}")
    return "\n".join(out) if out else "  (no operations)"


def apply_to_schema(schema_path: Path, ops: Iterable[Operation]) -> tuple[str, RunResult]:
    """Compute the modified schema text. Pure function — does not write to disk."""
    text = schema_path.read_text(encoding="utf-8")
    result = RunResult()
    for op in ops:
        if op.kind == "log-only":
            result.applied.append(op)
            continue
        try:
            text = _apply_one(text, op)
            result.applied.append(op)
        except _OpError as e:
            result.skipped.append((op, str(e)))
    return text, result


class _OpError(Exception):
    pass


def _theme_row_re(theme_id: str) -> re.Pattern[str]:
    # Match an INSERT row inside the seed block where the first column equals theme_id.
    quoted = re.escape(theme_id)
    return re.compile(rf"\(\s*'{quoted}'\s*,[^)]*\)\s*,?\s*\n", re.MULTILINE)


def _theme_locale_update_re(theme_id: str) -> re.Pattern[str]:
    quoted = re.escape(theme_id)
    return re.compile(
        rf"UPDATE\s+themes\s+SET[^;]*WHERE\s+theme_id\s*=\s*'{quoted}'\s*;\s*\n",
        re.MULTILINE | re.IGNORECASE | re.DOTALL,
    )


def _apply_one(text: str, op: Operation) -> str:
    if op.kind == "add":
        return _apply_add(text, op)
    if op.kind == "rewrite-description":
        return _apply_rewrite_description(text, op)
    if op.kind == "rename":
        return _apply_rename(text, op)
    if op.kind == "merge":
        return _apply_merge(text, op)
    if op.kind == "split":
        return _apply_split(text, op)
    if op.kind == "promote-candidate":
        return _apply_promote(text, op)
    raise _OpError(f"unknown operation kind: {op.kind}")


def _apply_add(text: str, op: Operation) -> str:
    theme_id = op.args["theme_id"]
    category_id = op.args["category_id"]
    if re.search(rf"'{re.escape(theme_id)}'", text):
        raise _OpError(f"theme_id {theme_id!r} already present in schema; refusing to duplicate")
    if not re.search(rf"'{re.escape(category_id)}'", text):
        raise _OpError(f"category_id {category_id!r} not present in schema; cannot add theme under it")
    canonical = theme_id.split(".")[-1].replace("_", " ").title()
    short = canonical[:20]
    description = "(description pending; populated by next compose-theme-proposal run)"
    new_row = (
        f"  ('{theme_id}', '{category_id.split('.')[0]}', '{category_id}', "
        f"'{canonical}', '{short}', '{canonical}',\n   '{description}', 'active'),\n"
    )
    return _insert_before_themes_seed_terminator(text, new_row)


def _insert_before_themes_seed_terminator(text: str, new_row: str) -> str:
    # The themes seed block ends with `;` after the last `(...)` row.
    pattern = re.compile(
        r"(INSERT\s+OR\s+IGNORE\s+INTO\s+themes\s*\([^)]*\)\s*VALUES\s*(?:\([^;]*\)\s*,?\s*)*)(\([^;]*\))(\s*;\s*\n)",
        re.IGNORECASE | re.DOTALL,
    )
    m = pattern.search(text)
    if not m:
        raise _OpError("could not locate themes seed block to append into")
    head = m.group(1)
    last_row = m.group(2)
    tail = m.group(3)
    new_block = head + last_row + ",\n" + new_row.rstrip(",\n") + tail
    return text[: m.start()] + new_block + text[m.end():]


def _apply_rewrite_description(text: str, op: Operation) -> str:
    ids = op.args.get("theme_ids") or []
    if not ids:
        raise _OpError("rewrite-description: no theme_ids extracted from recommendation line")
    # Best-effort: leave the actual description text untouched (the recommender
    # phrase carries keyword guidance; populating it requires writer context the
    # skill does not have). Mark the row with a description-pending stub so the
    # next theme-review pass can refine it.
    for theme_id in ids:
        pattern = re.compile(
            rf"(\(\s*'{re.escape(theme_id)}'\s*,\s*'[^']+'\s*,\s*'[^']+'\s*,\s*'[^']+'\s*,\s*'[^']*'\s*,\s*'[^']*',\s*\n\s*)'([^']*)'",
            re.MULTILINE,
        )
        if not pattern.search(text):
            raise _OpError(f"theme_id {theme_id!r} description row not found")
        # Use straight-quote-free text so we never inject an unescaped
        # apostrophe into a single-quoted SQL string. The phrase is a
        # placeholder; the real rewrite lands in a follow-up writer pass.
        text = pattern.sub(
            lambda m: m.group(1) + "'(description-rewrite pending — see this week theme-review proposal)'",
            text,
            count=1,
        )
    return text


def _apply_rename(text: str, op: Operation) -> str:
    old_id, new_id = op.args["old_id"], op.args["new_id"]
    if not re.search(rf"'{re.escape(old_id)}'", text):
        raise _OpError(f"theme_id {old_id!r} not found")
    text = re.sub(rf"'{re.escape(old_id)}'", f"'{new_id}'", text)
    new_canonical = new_id.split(".")[-1].replace("_", " ").title()
    text = re.sub(
        rf"(\(\s*'{re.escape(new_id)}'\s*,\s*'[^']+'\s*,\s*'[^']+'\s*,\s*)'([^']+)'",
        rf"\1'{new_canonical}'",
        text,
        count=1,
    )
    return text


def _apply_merge(text: str, op: Operation) -> str:
    absorbed = op.args["absorbed_id"]
    pattern = _theme_row_re(absorbed)
    if not pattern.search(text):
        raise _OpError(f"theme_id {absorbed!r} not found")
    text = pattern.sub("", text, count=1)
    locale_pattern = _theme_locale_update_re(absorbed)
    text = locale_pattern.sub("", text)
    return text


def _apply_split(text: str, op: Operation) -> str:
    raise _OpError(
        "split requires per-sub-topic naming + child mapping that this skill does not have; "
        "do this manually after reviewing the proposal"
    )


def _apply_promote(text: str, op: Operation) -> str:
    candidate_id = op.args["candidate_id"]
    update = (
        f"\nUPDATE theme_candidates SET status='promoted', promoted_theme_id='theme_for_{candidate_id}'\n"
        f"WHERE candidate_id='{candidate_id}';\n"
    )
    return text.rstrip() + update


def write_atomic(target: Path, content: str) -> None:
    fd, tmp_path = tempfile.mkstemp(prefix=target.name + ".", dir=str(target.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as f:
            f.write(content)
        os.replace(tmp_path, target)
    except Exception:
        try:
            os.remove(tmp_path)
        except OSError:
            pass
        raise


def validate_schema(schema_path: Path) -> tuple[bool, str]:
    """SQLite-syntax-check the schema file. Returns (ok, message)."""
    try:
        conn = sqlite3.connect(":memory:")
        try:
            conn.executescript(schema_path.read_text(encoding="utf-8"))
        finally:
            conn.close()
    except sqlite3.Error as e:
        return False, str(e)
    return True, "ok"


def restore_from_snapshot(schema_path: Path, snapshot_dir: Path) -> None:
    src = snapshot_dir / "schema.sql"
    if not src.is_file():
        raise FileNotFoundError(f"snapshot schema.sql missing at {src}")
    shutil.copy2(src, schema_path)


def make_diff(before: str, after: str, label: str) -> str:
    import difflib
    lines = list(difflib.unified_diff(
        before.splitlines(keepends=True),
        after.splitlines(keepends=True),
        fromfile=f"a/{label}",
        tofile=f"b/{label}",
    ))
    return "".join(lines)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Apply a theme-review proposal to schema.sql")
    p.add_argument("--proposal", required=True, type=Path)
    p.add_argument("--schema", required=True, type=Path)
    p.add_argument("--snapshot", required=True, type=Path)
    p.add_argument("--mode", choices=["manual", "auto"], default="manual")
    args = p.parse_args(argv)

    dry_run = os.environ.get("DRY_RUN") == "1"

    if not args.proposal.is_file():
        print(f"FAIL proposal not found: {args.proposal}", file=sys.stderr)
        return 2
    if not args.schema.is_file():
        print(f"FAIL schema not found: {args.schema}", file=sys.stderr)
        return 2
    if not (args.snapshot / "schema.sql").is_file():
        print(f"FAIL snapshot schema.sql missing: {args.snapshot}/schema.sql", file=sys.stderr)
        print("Run snapshot-3-time-state first (5_weekly_theme_review Step 0.5).", file=sys.stderr)
        return 2

    before = args.schema.read_text(encoding="utf-8")
    ops = parse_proposal(args.proposal)
    print(f"Plan ({len(ops)} ops):")
    print(render_plan(ops))

    after, result = apply_to_schema(args.schema, ops)
    diff = make_diff(before, after, str(args.schema))
    if not diff:
        print("No schema delta — nothing to write.")
        return 0

    print("\nDiff (preview):")
    print(diff[:4000] + ("\n…(truncated)" if len(diff) > 4000 else ""))

    if dry_run:
        print("\nDRY_RUN=1 — exiting without writing.")
        return 0

    if args.mode == "manual":
        if not sys.stdin.isatty():
            print("\nmanual mode + non-tty — refusing to write. Re-run with --mode auto or DRY_RUN=1.")
            return 0
        ans = input(f"\nApply {len(result.applied)} operations? [y/N]: ").strip().lower()
        if ans != "y":
            print("Aborted by operator. No write.")
            return 0

    write_atomic(args.schema, after)
    print(f"Wrote {args.schema} ({len(after)} bytes).")

    ok, msg = validate_schema(args.schema)
    if not ok:
        print(f"FAIL post-write SQLite validation: {msg}", file=sys.stderr)
        print("Restoring from snapshot…", file=sys.stderr)
        restore_from_snapshot(args.schema, args.snapshot)
        print(f"Restored {args.schema} from {args.snapshot}/schema.sql", file=sys.stderr)
        return 1

    print("Validation OK.")
    if result.skipped:
        print(f"\nSkipped {len(result.skipped)} operations:")
        for op, why in result.skipped:
            print(f"  - [{op.kind}] {why}: {op.raw_line[:80]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
