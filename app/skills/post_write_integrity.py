"""Post-write integrity check (shared across daily/weekly tasks).

Spec: ``design/skills/post-write-integrity.md``.

Two stages per path:
  1. Bridge integrity — NUL-tail strip with atomic temp+rename.
  2. Structural completeness — kind-specific markdown shape check.

Exits 1 if any path fails the structural check OR triggers a second
repair-in-a-row for the same path within this run.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import tempfile
from pathlib import Path

REPAIR_MEMO: dict[str, int] = {}


# ---------------------------------------------------------------------------
# Stage 1: NUL-tail repair
# ---------------------------------------------------------------------------


def _bridge_integrity(path: Path) -> str:
    if not path.exists():
        return f"FAIL missing: {path}"
    data = path.read_bytes()
    if not data:
        return f"FAIL empty: {path}"
    if data[-1:] == b"\x00" or b"\x00" in data[-512:]:
        fixed = data.rstrip(b"\x00")
        # Track repair count for this path inside the current process —
        # if we hit a second repair on the same path, escalate.
        key = str(path.resolve())
        REPAIR_MEMO[key] = REPAIR_MEMO.get(key, 0) + 1
        if REPAIR_MEMO[key] >= 2:
            return (
                f"FAIL repair-twice for {path} — bridge degraded; aborting"
            )
        # Atomic write: tmp + replace.
        fd, tmp = tempfile.mkstemp(prefix=path.name + ".", dir=str(path.parent))
        try:
            with os.fdopen(fd, "wb") as f:
                f.write(fixed)
            os.replace(tmp, path)
        except Exception:
            try:
                os.remove(tmp)
            except OSError:
                pass
            raise
        return f"REPAIRED {path}: stripped {len(data) - len(fixed)} trailing NUL byte(s)"
    return f"OK {path} ({len(data)} bytes)"


# ---------------------------------------------------------------------------
# Stage 2: structural completeness, by kind
# ---------------------------------------------------------------------------


def _check_news(text: str) -> list[str]:
    errors: list[str] = []
    required = ["## Headlines", "## Future", "## Change Log", "## News"]
    for h in required:
        if not re.search(rf"^{re.escape(h)}\s*$", text, re.MULTILINE):
            errors.append(f"missing H2 section: {h!r}")
    fut = re.search(r"^## Future\s*$(.*?)(?=^##\s|\Z)", text, re.MULTILINE | re.DOTALL)
    if fut:
        items = re.findall(r"^\s*\d+\.\s+\S", fut.group(1), re.MULTILINE)
        if len(items) < 3:
            errors.append(f"## Future has only {len(items)} numbered item(s); spec requires 3")
    else:
        errors.append("could not locate ## Future body for item count check")
    if not text.endswith("\n"):
        errors.append("file does not end with newline (likely truncated mid-token)")
    tail = text.rstrip()[-200:]
    if re.search(r"\[[^\]\n]*$", tail) or re.search(r"\([^)\n]*$", tail):
        errors.append("trailing markdown link looks unclosed (truncated mid-link)")
    if text.count("**") % 2 != 0:
        errors.append("unbalanced ** bold markers in document (truncated mid-bold)")
    return errors


def _check_future_prediction(text: str) -> list[str]:
    errors: list[str] = []
    # Legacy markdown carries `## Checking Predictions Against Reality`;
    # Phase 3 renderer emits `## Validation findings` for the same
    # structural slot. Accept either header so this gate works on both
    # the legacy corpus and the new sourcedata-rendered output. The
    # `## Summary of Findings` + `## Relation to My Own Predictions`
    # blocks are optional in the new template (only emitted when a
    # `summary.json` sibling exists), so they're no longer required.
    table_header_pattern = (
        r"^##\s+(?:Checking Predictions Against Reality|Validation findings)\s*$"
    )
    if not re.search(table_header_pattern, text, re.MULTILINE):
        errors.append(
            "missing H2 section: '## Checking Predictions Against Reality' "
            "or '## Validation findings'"
        )
    sec = re.search(
        rf"{table_header_pattern}(.*?)(?=^##\s|\Z)",
        text, re.MULTILINE | re.DOTALL,
    )
    if sec:
        body = sec.group(1)
        rows = [ln for ln in body.splitlines() if ln.strip().startswith("|")]
        if len(rows) >= 2:
            header_pipes = rows[0].count("|")
            for i, r in enumerate(rows):
                if r.count("|") != header_pipes:
                    errors.append(
                        f"validation table row {i} has {r.count('|')} pipes, expected {header_pipes}"
                    )
                    break
        body_lines = body.splitlines()
        last_pipe = max(
            (i for i, ln in enumerate(body_lines) if ln.strip().startswith("|")),
            default=-1,
        )
        if last_pipe >= 0 and last_pipe == len(body_lines) - 1:
            errors.append(
                "validation table ends at section EOF without closing blank line (likely truncated)"
            )
    else:
        errors.append(
            "could not locate '## Checking Predictions Against Reality' "
            "or '## Validation findings' body"
        )
    if not text.endswith("\n"):
        errors.append("file does not end with newline (likely truncated mid-token)")
    tail = text.rstrip()[-200:]
    if re.search(r"\[[^\]\n]*$", tail) or re.search(r"\([^)\n]*$", tail):
        errors.append("trailing markdown link looks unclosed (truncated mid-link)")
    if text.count("**") % 2 != 0:
        errors.append("unbalanced ** bold markers in document (truncated mid-bold)")
    return errors


def _check_dormant(text: str) -> list[str]:
    errors: list[str] = []
    if not re.search(r"^# Dormant pool — week ending \d{4}-\d{2}-\d{2}\s*$", text, re.MULTILINE):
        errors.append("missing top-level dormant pool header")
    if not re.search(r"^## Tier: Dormant", text, re.MULTILINE):
        errors.append("missing `## Tier: Dormant …` header")
    sections = re.findall(r"^## Tier:.*?\n(.*?)(?=^## Tier:|\Z)", text, re.MULTILINE | re.DOTALL)
    for i, sec in enumerate(sections):
        rows = [ln for ln in sec.splitlines() if ln.strip().startswith("|")]
        if not rows:
            errors.append(f"tier section {i}: no markdown table at all")
            continue
        if len(rows) < 2:
            errors.append(f"tier section {i}: table missing separator row (header without |---| line)")
            continue
        expected = rows[0].count("|")
        for j, r in enumerate(rows):
            if r.count("|") != expected:
                errors.append(f"tier section {i} row {j}: {r.count('|')} pipes, expected {expected}")
                break
    if not text.endswith("\n"):
        errors.append("file does not end with newline (likely truncated mid-token)")
    tail = text.rstrip()[-200:]
    if re.search(r"\|\s*[^\|\n]*$", tail) and not tail.rstrip().endswith("|"):
        errors.append("tail looks like an unclosed table row (no trailing pipe)")
    if text.count("**") % 2 != 0:
        errors.append("unbalanced ** bold markers in document")
    return errors


def _check_theme_review(text: str) -> list[str]:
    errors: list[str] = []
    required = [
        "## Empty / underused themes",
        "## Overpopulated themes",
        "## Theme candidates",
        "## Recommended actions",
    ]
    for h in required:
        if not re.search(rf"^{re.escape(h)}", text, re.MULTILINE):
            errors.append(f"missing H2 section starting with: {h!r}")
    ra = re.search(r"^## Recommended actions\s*$(.*?)(?=^##\s|\Z)", text, re.MULTILINE | re.DOTALL)
    if ra:
        items = re.findall(r"^\s*\d+\.\s+\S", ra.group(1), re.MULTILINE)
        if len(items) > 5:
            errors.append(f"## Recommended actions has {len(items)} items; spec caps at 5")
        if items:
            last = re.split(r"^\s*\d+\.\s+", ra.group(1), flags=re.MULTILINE)[-1].strip()
            if len(last) < 20 or re.search(r"[(\[→]\s*$", last):
                errors.append(f"## Recommended actions: last item looks truncated: {last!r}")
    else:
        errors.append("could not locate ## Recommended actions body")
    if not text.endswith("\n"):
        errors.append("file does not end with newline (likely truncated mid-token)")
    tail = text.rstrip()[-300:]
    if re.search(r"\[[^\]\n]*$", tail) or re.search(r"\([^)\n]*$", tail):
        errors.append("trailing markdown link looks unclosed (truncated mid-link)")
    if text.count("**") % 2 != 0:
        errors.append("unbalanced ** bold markers in document (truncated mid-bold)")
    if text.count("`") % 2 != 0:
        errors.append("unbalanced ` code markers in document (truncated mid-code)")
    return errors


def _check_readme(text: str) -> list[str]:
    errors: list[str] = []
    if not re.search(r"\n---\s*\n*\Z", text):
        errors.append("does not end with `---` separator (likely truncated mid-block)")
    blocks = re.findall(
        r"^## (\d{4}-\d{2}-\d{2})\s*$(.*?)(?=^## \d{4}-\d{2}-\d{2}\s*$|\Z)",
        text, re.MULTILINE | re.DOTALL,
    )
    for date, body in blocks:
        if not re.search(r"^### News\s*$", body, re.MULTILINE):
            errors.append(f"## {date}: missing `### News`")
        if not re.search(r"^### Predictions check\s*$", body, re.MULTILINE):
            errors.append(f"## {date}: missing `### Predictions check`")
        news_body = re.search(r"^### News\s*$(.*?)(?=^###\s|\Z)", body,
                              re.MULTILINE | re.DOTALL)
        if news_body and not re.search(r"\[news-\d{8}\.md\]\(report/", news_body.group(1)):
            errors.append(f"## {date} ### News: missing terminating [news-…](report/<L>/…) link")
        pred_body = re.search(
            r"^### Predictions check\s*$(.*?)(?=^###\s|^## \d{4}-\d{2}-\d{2}\s*$|\Z)",
            body, re.MULTILINE | re.DOTALL,
        )
        if pred_body and not re.search(
            r"\[future-prediction-\d{8}\.md\]\(future-prediction/", pred_body.group(1)
        ):
            errors.append(f"## {date} ### Predictions check: missing terminating [future-prediction-…] link")
    tail = text.rstrip()[-300:]
    if re.search(r"\[[^\]\n]*$", tail) or re.search(r"\([^)\n]*$", tail):
        errors.append("trailing markdown link looks unclosed (truncated mid-link)")
    if text.count("**") % 2 != 0:
        errors.append("unbalanced ** bold markers in document (truncated mid-bold)")
    return errors


def _check_dashboard_asset(path: Path, text: str) -> list[str]:
    errors: list[str] = []
    name = path.name
    if name == "index.html" and not re.search(r"</html>\s*$", text):
        errors.append("missing closing </html>")
    elif name == "app.js" and not re.search(r"\}\)\(\);?\s*$", text):
        errors.append("missing trailing })(); IIFE marker")
    elif name == "styles.css" and not re.search(r"\}\s*$", text):
        errors.append("missing trailing } CSS rule terminator")
    return errors


_CHECKERS = {
    "news":             _check_news,
    "future-prediction": _check_future_prediction,
    "dormant":          _check_dormant,
    "theme-review":     _check_theme_review,
    "readme":           _check_readme,
}


def _structural_completeness(path: Path, kind: str) -> list[str]:
    if kind == "dashboard-asset":
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            return [f"file is not valid UTF-8: {path}"]
        return _check_dashboard_asset(path, text)
    fn = _CHECKERS.get(kind)
    if fn is None:
        return [f"unknown kind: {kind!r}"]
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return [f"file is not valid UTF-8: {path}"]
    return fn(text)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Post-write integrity check (NUL-tail + structural completeness)")
    p.add_argument("--kind", required=True,
                   choices=["news", "future-prediction", "dormant",
                            "theme-review", "readme", "dashboard-asset"])
    p.add_argument("--path", action="append", required=True, type=Path,
                   help="Path to a file to check. Repeat for multiple files.")
    args = p.parse_args(argv)
    failed = False
    for path in args.path:
        # Stage 1
        report = _bridge_integrity(path)
        print(report)
        if report.startswith("FAIL"):
            failed = True
            continue
        # Stage 2
        errors = _structural_completeness(path, args.kind)
        if errors:
            print(f"FAIL structural completeness: {path}")
            for e in errors:
                print(f"  - {e}")
            failed = True
        else:
            print(f"OK structural completeness: {path}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
