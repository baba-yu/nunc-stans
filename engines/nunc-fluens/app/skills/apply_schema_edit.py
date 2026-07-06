"""Apply a theme-review proposal to app/src/schema.sql.

Independent skill extracted from `design/scheduled/5_weekly_theme_review.md`
Step 5. Runs in manual mode by default — proposal review must happen
before any write hits disk.

See `design/skills/apply-schema-edit.md` for the full spec.
"""

from __future__ import annotations

import argparse
import json
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
    """Parse the `## Recommended actions` section into typed operations.

    Items are delimited by either `N. ` numbered-list markers or `### Action N:`
    H3 headers (both forms are accepted — see the item_start note below). Each
    recommendation may carry a fenced ```action / ```json block with the
    authoritative machine-parseable directive (`kind`, ids, new description,
    locale fields). The block, when present, overrides the prose classification
    — the prose stays for human review, the JSON drives apply.
    """
    text = path.read_text(encoding="utf-8")
    m = re.search(
        r"^##\s+Recommended actions\s*$(.*?)(?=^##\s|\Z)",
        text,
        re.MULTILINE | re.DOTALL,
    )
    if not m:
        raise ValueError(f"{path}: no `## Recommended actions` section found")

    body = m.group(1)
    # A recommendation item begins at EITHER a numbered-list marker (`N. `, the
    # convention through 2026-05-24) OR an H3 header (`### Action N: …`, the
    # format every weekly proposal has used since 2026-05-31). Matching only the
    # numbered form made this return 0 items on every H3-style proposal, so
    # `apply-schema-edit --mode auto` silently no-op'd for 6+ weeks. Splitting on
    # either boundary parses both styles; the numbered branch is unchanged, so
    # older proposals still parse identically. The authoritative directive is the
    # fenced ```action block inside each item (see design/memory-policy.md §2.1).
    item_start = r"(?:^\s*\d+\.\s+|^###\s+)"
    items = re.findall(
        rf"{item_start}(.+?)(?={item_start}|\Z)",
        body,
        re.MULTILINE | re.DOTALL,
    )
    ops: list[Operation] = []
    for raw in items:
        flat = " ".join(line.strip() for line in raw.splitlines()).strip()
        block = _extract_action_json(raw)
        op = _classify(flat)
        if block:
            op.args["json_block"] = block
            jk = block.get("kind")
            if jk in ("add", "rewrite-description", "rename", "merge",
                      "split", "promote-candidate", "log-only"):
                op.kind = jk
                for k in ("theme_id", "category_id", "old_id", "new_id",
                          "absorbed_id", "survivor_id", "candidate_id"):
                    if k in block and k not in op.args:
                        op.args[k] = block[k]
        ops.append(op)
    return ops


def _extract_action_json(item_text: str) -> dict | None:
    """Extract the first fenced ```action / ```json block from a recommendation.

    Returns None if no block exists or the block fails to JSON-parse.
    Apply-side callers must tolerate missing blocks (older proposals + advisory
    items both legitimately omit them).
    """
    # Allow leading whitespace before either fence (markdown numbered-list
    # body content is typically indented under its parent item by 3+ spaces).
    m = re.search(r"```(?:action|json)\s*\n(.*?)\n[ \t]*```", item_text, re.DOTALL)
    if not m:
        return None
    try:
        obj = json.loads(m.group(1).strip())
    except json.JSONDecodeError:
        return None
    return obj if isinstance(obj, dict) else None


# Prose-classification regexes (fallback when no JSON action block is present).
# Match either:
#   "Add `theme_id` theme under `category_id`"    (legacy single-line form)
#   "Add new theme `theme_id`"                    (current convention; category from JSON)
_RE_ADD = re.compile(
    r"\bAdd\s+`?(?P<theme_id>[\w.\-_]+)`?\s+theme\s+under\s+`?(?P<category_id>[\w.\-_]+)`?",
    re.IGNORECASE,
)
_RE_ADD_NEW = re.compile(
    r"\bAdd\s+new\s+theme\s+`?(?P<theme_id>[\w.\-_]+)`?",
    re.IGNORECASE,
)
_RE_RENAME = re.compile(r"\bRename\s+`?(?P<old>[\w.\-_]+)`?\s*[→\->]+\s*`?(?P<new>[\w.\-_]+)`?", re.IGNORECASE)
_RE_MERGE = re.compile(r"\bMerge\s+`?(?P<absorbed>[\w.\-_]+)`?\s+into\s+`?(?P<survivor>[\w.\-_]+)`?", re.IGNORECASE)
_RE_SPLIT = re.compile(r"\bSplit\s+`?(?P<theme_id>[\w.\-_]+)`?", re.IGNORECASE)
_RE_PROMOTE = re.compile(r"\bPromote\s+candidate\s+`?(?P<candidate_id>[\w.\-_]+)`?", re.IGNORECASE)
_RE_TIGHTEN = re.compile(r"\b(?:Tighten|Rewrite)\s+description", re.IGNORECASE)
_RE_LOG_ONLY = re.compile(r"\b(Investigate|Investigation|No\s+splits|out of scope|no schema edit)\b", re.IGNORECASE)


def _classify(line: str) -> Operation:
    if (m := _RE_ADD.search(line)):
        return Operation("add", line, {"theme_id": m.group("theme_id"), "category_id": m.group("category_id")})
    if (m := _RE_ADD_NEW.search(line)):
        # category_id absent from prose — caller must supply via JSON action block.
        return Operation("add", line, {"theme_id": m.group("theme_id")})
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
        # First inline backtick id is the canonical target when a JSON block
        # is absent; downstream code reads `theme_ids` (list) and `theme_id` (single).
        args: dict = {"theme_ids": ids}
        if ids:
            args["theme_id"] = ids[0]
        return Operation("rewrite-description", line, args)
    if _RE_LOG_ONLY.search(line):
        return Operation("log-only", line, note="advisory; no schema edit")
    return Operation("log-only", line, note="unrecognized recommendation; skipping")


def render_plan(ops: Iterable[Operation]) -> str:
    """Human-readable plan for stdout / dry-run output.

    Skips the verbose `json_block` arg (its full text is in the proposal
    file; we don't need to echo it here, and locale descriptions break the
    Windows default cp1252 stdout encoding).
    """
    out = []
    for i, op in enumerate(ops, 1):
        if op.kind == "log-only":
            out.append(f"  {i}. [log-only] {op.note}: {op.raw_line[:80]}")
        else:
            args_str = " ".join(
                f"{k}={v}"
                for k, v in op.args.items()
                if k != "json_block"
            )
            json_marker = " (+JSON action block)" if "json_block" in op.args else ""
            out.append(f"  {i}. [{op.kind}] {args_str}{json_marker}")
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


def _sql_escape(s: str) -> str:
    """Escape single quotes for embedding in SQL single-quoted literals."""
    return s.replace("'", "''")


def _apply_add(text: str, op: Operation) -> str:
    theme_id = op.args.get("theme_id")
    category_id = op.args.get("category_id")
    if not theme_id:
        raise _OpError("add: missing theme_id (provide in prose 'Add new theme `<id>`' or JSON block)")
    if not category_id:
        raise _OpError(
            f"add: missing category_id for theme {theme_id!r}; "
            "provide via JSON action block ({'category_id': '<id>'}) or the legacy 'Add `<id>` theme under `<cat>`' prose form"
        )
    if re.search(rf"'{re.escape(theme_id)}'", text):
        raise _OpError(f"theme_id {theme_id!r} already present in schema; refusing to duplicate")
    if not re.search(rf"'{re.escape(category_id)}'", text):
        raise _OpError(f"category_id {category_id!r} not present in schema; cannot add theme under it")

    block = op.args.get("json_block") or {}
    canonical_default = theme_id.split(".")[-1].replace("_", " ").title()
    label_en = block.get("label_en") or canonical_default
    short_en = block.get("short_label_en") or label_en[:20]
    tooltip_en = block.get("tooltip_en") or label_en
    description_en = block.get("description_en") or "(description pending; populated by next compose-theme-proposal run)"
    scope = category_id.split(".")[0]
    new_row = (
        f"  ('{_sql_escape(theme_id)}', '{_sql_escape(scope)}', '{_sql_escape(category_id)}', "
        f"'{_sql_escape(label_en)}', '{_sql_escape(short_en)}', '{_sql_escape(tooltip_en)}',\n"
        f"   '{_sql_escape(description_en)}', 'active'),\n"
    )
    text = _insert_before_themes_seed_terminator(text, new_row)

    # Append a locale UPDATE block at the end of the theme UPDATE region when
    # the JSON action block carries any locale fields. Skipping the UPDATE is
    # acceptable but loses locale coverage (frontend falls back to EN).
    if any(k in block for k in ("label_ja", "label_es", "label_fil",
                                 "short_label_ja", "short_label_es", "short_label_fil",
                                 "description_ja", "description_es", "description_fil")):
        text = _append_locale_update_for_new_theme(text, theme_id, block)
    return text


def _append_locale_update_for_new_theme(text: str, theme_id: str, block: dict) -> str:
    """Insert a locale UPDATE block at the end of the theme UPDATE region."""
    # Build label / short_label / description lines per locale.
    parts: list[str] = []
    for loc in ("ja", "es", "fil"):
        label = block.get(f"label_{loc}")
        short = block.get(f"short_label_{loc}")
        if label and short:
            parts.append(f"  label_{loc} = '{_sql_escape(label)}', short_label_{loc} = '{_sql_escape(short)}'")
    for loc in ("ja", "es", "fil"):
        desc = block.get(f"description_{loc}")
        if desc:
            parts.append(f"  description_{loc} = '{_sql_escape(desc)}'")
    if not parts:
        return text
    update_block = (
        "\nUPDATE themes SET\n"
        + ",\n".join(parts)
        + f"\nWHERE theme_id = '{_sql_escape(theme_id)}';\n"
    )
    # Insert before the section-17 migration-note marker. If the marker is
    # missing (older schema or hand-edits), fall back to appending at EOF.
    marker = re.search(
        r"\n-- ={5,}\s*\n-- 17\. Migration note",
        text,
    )
    if marker:
        return text[: marker.start()] + update_block + text[marker.start():]
    return text.rstrip() + "\n" + update_block


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
    block = op.args.get("json_block") or {}
    # JSON authoritative: a single-target block. Prose fallback: list of ids.
    json_target = block.get("theme_id") or op.args.get("theme_id")
    ids = [json_target] if json_target else (op.args.get("theme_ids") or [])
    if not ids:
        raise _OpError("rewrite-description: no theme_id available (set in JSON block or prose)")

    new_desc_en = block.get("new_description_en") or block.get("new_description")
    new_desc_locales = {
        "ja": block.get("new_description_ja"),
        "es": block.get("new_description_es"),
        "fil": block.get("new_description_fil"),
    }

    for theme_id in ids:
        # Match the description column (7th column) of the themes seed row.
        pattern = re.compile(
            rf"(\(\s*'{re.escape(theme_id)}'\s*,\s*'[^']+'\s*,\s*'[^']+'\s*,\s*'[^']+'\s*,\s*'[^']*'\s*,\s*'[^']*',\s*\n\s*)'((?:[^']|'')*)'",
            re.MULTILINE,
        )
        if not pattern.search(text):
            raise _OpError(f"theme_id {theme_id!r} description row not found")
        replacement = new_desc_en if new_desc_en else "(description-rewrite pending — see this week theme-review proposal)"
        escaped = _sql_escape(replacement)
        text = pattern.sub(lambda m: m.group(1) + f"'{escaped}'", text, count=1)

        # Locale description columns live in the trailing UPDATE block(s).
        # Upsert per-locale `description_<loc>` into the existing UPDATE for
        # this theme_id; append a new UPDATE if none exists.
        for loc, val in new_desc_locales.items():
            if not val:
                continue
            text = _upsert_locale_description(text, theme_id, loc, val)

    return text


def _upsert_locale_description(text: str, theme_id: str, locale: str, new_value: str) -> str:
    """Add or replace `description_<locale>` inside the theme's locale UPDATE."""
    escaped = _sql_escape(new_value)
    update_re = _theme_locale_update_re(theme_id)
    m = update_re.search(text)
    if not m:
        # No existing UPDATE — append one with just the description for this locale.
        update_block = (
            f"\nUPDATE themes SET\n"
            f"  description_{locale} = '{escaped}'\n"
            f"WHERE theme_id = '{_sql_escape(theme_id)}';\n"
        )
        marker = re.search(r"\n-- ={5,}\s*\n-- 17\. Migration note", text)
        if marker:
            return text[: marker.start()] + update_block + text[marker.start():]
        return text.rstrip() + "\n" + update_block
    # Existing UPDATE — try in-place replace of description_<locale> = '...';
    # else inject the column right before WHERE.
    block_text = m.group(0)
    col_re = re.compile(
        rf"description_{locale}\s*=\s*'((?:[^']|'')*)'",
        re.IGNORECASE,
    )
    if col_re.search(block_text):
        new_block_text = col_re.sub(f"description_{locale} = '{escaped}'", block_text, count=1)
    else:
        # Inject before WHERE clause; append `,` to the prior SET column.
        injected = re.sub(
            r"\n(WHERE\s+theme_id)",
            f",\n  description_{locale} = '{escaped}'\n\\1",
            block_text,
            count=1,
            flags=re.IGNORECASE,
        )
        new_block_text = injected
    return text[: m.start()] + new_block_text + text[m.end():]


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
    # Windows consoles default to cp1252; the schema diff embeds the theme
    # seeds' Japanese / Spanish / Filipino text. Force UTF-8 so printing the
    # diff cannot crash with UnicodeEncodeError.
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass
    p = argparse.ArgumentParser(description="Apply a theme-review proposal to schema.sql")
    p.add_argument("--proposal", required=True, type=Path)
    p.add_argument("--schema", required=True, type=Path)
    p.add_argument("--snapshot", required=True, type=Path)
    p.add_argument("--mode", choices=["manual", "auto"], default="auto")
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
