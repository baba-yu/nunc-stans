"""Lint check: forbidden internal-pipeline tokens in user-facing markdown.

Spec: ``design/sourcedata-layout.md §Naming hygiene`` and Phase 3
``§Test gate``.

Walks every ``.md`` under ``report/`` and ``future-prediction/`` for a
given date (Phase 3 scope — Phase 5 will run this corpus-wide). On each
file, greps for the forbidden-token list. Exits 0 with ``OK`` on a
clean walk, 1 with explicit per-file findings on any hit.

The lint is intentionally narrow: the goal is to prove that the new
renderer never emits Stream-jargon / parser-anchor tokens in human-
facing markdown. Phase 4 will run this against the legacy corpus once
those files have been re-rendered.

CLI:

  python -m app.skills.lint_markdown_clean --date 2026-05-04
  python -m app.skills.lint_markdown_clean --paths /tmp/synthetic.md
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


# Each entry: (token_label_for_humans, regex_pattern, flags).
# Patterns are deliberately strict — false positives here block ship.
_FORBIDDEN: list[tuple[str, str, int]] = [
    # Coined project terms.
    ("eli14", r"\beli14\b", re.IGNORECASE),
    ("JTBD", r"\bJTBD\b", 0),
    # "Stream A/B/C/D/E/F/J/K" — case-insensitive, whole-word boundary.
    ("Stream A/B/C/D/E/F/J/K", r"\bStream\s+[A-FJK]\b", 0),
    ("Reasoning trace", r"\bReasoning trace\b", re.IGNORECASE),
    # Internal IDs.
    # `Pred ID #N` (also `Prediction ID #N`).
    ("Pred ID #N", r"\bPred(?:iction)?\s*ID\s*#\d+", re.IGNORECASE),
    ("Need ID #N", r"\bNeed\s*ID\s*#\d+", re.IGNORECASE),
    ("Bridge ID #N", r"\bBridge\s*ID\s*#\d+", re.IGNORECASE),
    # Hash-style internal references like `prediction.adb89416691d7587`.
    ("prediction.<hash>", r"\bprediction\.[0-9a-f]{8,}\b", 0),
    ("need.<hash>", r"\bneed\.[0-9a-f]{8,}\b", 0),
    # Parser anchors.
    ("**Summary:** parser anchor", r"\*\*Summary\s*:\s*\*\*", 0),
    # `**Bridge (...)**` — narrowly target the parenthetical-containing
    # variant to avoid clipping legitimate prose like "## Bridge".
    ("**Bridge (...):** parser anchor", r"\*\*Bridge\s*\([^)]*\)\s*:\s*\*\*", 0),
    ("Coherence N/5", r"\bCoherence\s+\d/5\b", re.IGNORECASE),
    ("Remaining gap:", r"\bRemaining\s+gap\s*:", re.IGNORECASE),
    # Bullet keys (the literal bullet at line start).
    ("- because: bullet key", r"^\s*-\s+because\s*:", re.MULTILINE),
    ("- given: bullet key", r"^\s*-\s+given\s*:", re.MULTILINE),
    ("- so_that: bullet key", r"^\s*-\s+so_that\s*:", re.MULTILINE),
    ("- landing: bullet key", r"^\s*-\s+landing\s*:", re.MULTILINE),
    ("- eli14: bullet key", r"^\s*-\s+eli14\s*:", re.MULTILINE),
    # Pipeline meta scope prefixes — already covered by an existing
    # rule in the writer flow; restated here so a single lint pass
    # covers the full forbidden-token catalogue.
    (
        "(Tech)/(Business)/(Mix) scope prefix",
        (
            r"\((?:Tech|Non-Tech|Non-tech|Business|Biz|Mix|Technical|"
            r"Non-Technical|Technology|Tecnolog[íi]a|Tec|No-Tec|"
            r"T[ée]cnico|Negocio|Teknikal|Hindi-Teknikal|Negosyo|Halong)\)"
        ),
        0,
    ),
    # JA scope prefixes use full-width parens.
    (
        "（技術）/（ビジネス）scope prefix",
        r"（(?:技術|非技術|テクノロジー|非テクノロジー|ビジネス|非ビジネス|ビジ|ミックス)）",
        0,
    ),
]


def _scan_file(path: Path) -> list[tuple[str, int, str]]:
    """Return a list of ``(token_label, line_number, snippet)`` hits."""
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as e:
        return [(f"<unreadable: {e}>", 0, "")]
    hits: list[tuple[str, int, str]] = []
    for label, pattern, flags in _FORBIDDEN:
        for m in re.finditer(pattern, text, flags):
            line_no = text.count("\n", 0, m.start()) + 1
            # Single-line snippet, truncated.
            line_start = text.rfind("\n", 0, m.start()) + 1
            line_end = text.find("\n", m.end())
            if line_end == -1:
                line_end = len(text)
            snippet = text[line_start:line_end].strip()
            if len(snippet) > 120:
                snippet = snippet[:117] + "..."
            hits.append((label, line_no, snippet))
    return hits


def _date_paths(repo_root: Path, date_iso: str) -> list[Path]:
    """Resolve every per-locale `news-YYYYMMDD.md` + `future-prediction-…`."""
    compact = date_iso.replace("-", "")
    out: list[Path] = []
    for locale in ("en", "ja", "es", "fil"):
        out.append(repo_root / "report" / locale / f"news-{compact}.md")
        out.append(
            repo_root
            / "future-prediction"
            / locale
            / f"future-prediction-{compact}.md"
        )
    return [p for p in out if p.is_file()]


def _safe_print(line: str) -> None:
    """Print a line that may contain Unicode the console can't encode.

    On Windows, the default cp1252 console raises ``UnicodeEncodeError``
    on any character outside Latin-1. Lint output frequently includes
    snippets with ``≥``, ``→``, etc., which would crash the runner mid-
    iteration. Re-encode through the stdout encoding with replacement
    so the lint can finish enumerating hits.
    """
    enc = (sys.stdout.encoding or "utf-8").lower()
    try:
        print(line)
    except UnicodeEncodeError:
        print(line.encode(enc, errors="replace").decode(enc, errors="replace"))


def lint_paths(paths: list[Path]) -> int:
    """Lint a concrete path list. Returns the desired exit code."""
    if not paths:
        _safe_print("OK lint-markdown-clean: no files to check")
        return 0
    failed = False
    for path in paths:
        hits = _scan_file(path)
        if hits:
            failed = True
            _safe_print(f"FAIL {path}: {len(hits)} forbidden-token hit(s)")
            for label, line_no, snippet in hits:
                _safe_print(f"  - line {line_no}: {label}")
                if snippet:
                    _safe_print(f"    {snippet}")
        else:
            _safe_print(f"OK {path}")
    if failed:
        return 1
    _safe_print(f"OK lint-markdown-clean: {len(paths)} file(s) clean")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        description=(
            "Greps user-facing markdown for forbidden internal-pipeline "
            "tokens (Stream A-K, Pred ID #N, parser anchors, eli14, ...)."
        )
    )
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument(
        "--date",
        help=(
            "ISO date YYYY-MM-DD. Lints every per-locale news-YYYYMMDD.md "
            "and future-prediction-YYYYMMDD.md under the repo."
        ),
    )
    g.add_argument(
        "--paths",
        nargs="+",
        help="Explicit path list (overrides --date).",
    )
    p.add_argument(
        "--repo-root",
        default=".",
        help="Repository root (defaults to cwd).",
    )
    args = p.parse_args(argv)

    repo_root = Path(args.repo_root).resolve()
    if args.paths:
        paths = [Path(p_) for p_ in args.paths]
    else:
        paths = _date_paths(repo_root, args.date)
    return lint_paths(paths)


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
