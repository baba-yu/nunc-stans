"""Locale fan-out (shared by tasks 1 and 2).

Spec: ``design/skills/locale-fanout.md``.

Python wrapper that the orchestrator feeds with already-translated text.
The actual EN→JA/ES/FIL translation is an LLM call inside the
orchestrator (writer-side); this module owns:

  - path templating per kind (`news` / `future-prediction`)
  - atomic write (tmp + replace) so partial writes never reach disk
  - post-write integrity dispatch
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import tempfile
from pathlib import Path
from typing import Iterable


LOCALES: tuple[str, ...] = ("ja", "es", "fil")

PATH_TEMPLATES: dict[str, str] = {
    "news":              "report/{locale}/{stem}.md",
    "future-prediction": "future-prediction/{locale}/{stem}.md",
}


def derive_paths(canonical_en: Path, kind: str) -> dict[str, Path]:
    """{locale: path} for the three sibling files this fan-out should write."""
    if kind not in PATH_TEMPLATES:
        raise ValueError(f"unknown kind {kind!r}; expected one of {list(PATH_TEMPLATES)}")
    stem = canonical_en.stem
    base = canonical_en.parents[2] if len(canonical_en.parents) >= 3 else Path.cwd()
    out: dict[str, Path] = {}
    for locale in LOCALES:
        rel = PATH_TEMPLATES[kind].format(locale=locale, stem=stem)
        out[locale] = (base / rel).resolve()
    return out


def write_atomic(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=path.name + ".", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as f:
            f.write(content)
        os.replace(tmp, path)
    except Exception:
        try:
            os.remove(tmp)
        except OSError:
            pass
        raise


def call_post_write_integrity(path: Path, kind: str) -> int:
    """Re-uses the post-write-integrity skill in-process."""
    from app.skills import post_write_integrity as pwi
    argv = ["--kind", kind, "--path", str(path)]
    return pwi.main(argv)


def fanout(
    canonical_en: Path,
    kind: str,
    *,
    translations: dict[str, str],
) -> int:
    """Write each locale + run post-write-integrity. Returns exit code 0/1."""
    paths = derive_paths(canonical_en, kind)
    failed = False
    for locale, path in paths.items():
        text = translations.get(locale)
        if text is None:
            print(f"FAIL {locale}: orchestrator did not supply a translation", file=sys.stderr)
            failed = True
            continue
        write_atomic(path, text)
        rc = call_post_write_integrity(path, kind)
        if rc != 0:
            print(f"FAIL {locale}:{path} — post-write integrity failed")
            failed = True
        else:
            print(f"OK {locale}:{path}")
    return 1 if failed else 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Write 3 sibling-locale files for an EN canonical")
    p.add_argument("--canonical-en", required=True, type=Path)
    p.add_argument("--kind", required=True, choices=list(PATH_TEMPLATES))
    p.add_argument("--ja-text-file", type=Path, help="Path containing the pre-translated JA body. If omitted, prints the path templates only.")
    p.add_argument("--es-text-file", type=Path)
    p.add_argument("--fil-text-file", type=Path)
    args = p.parse_args(argv)

    if not args.canonical_en.is_file():
        print(f"FAIL canonical-en not found: {args.canonical_en}", file=sys.stderr)
        return 2

    paths = derive_paths(args.canonical_en, args.kind)
    have_translations = any(
        getattr(args, f"{locale}_text_file") is not None for locale in LOCALES
    )
    if not have_translations:
        print("(no --{ja,es,fil}-text-file passed; printing target paths and exiting)")
        for locale, path in paths.items():
            print(f"  {locale}: {path}")
        return 0

    translations: dict[str, str] = {}
    for locale in LOCALES:
        f = getattr(args, f"{locale}_text_file")
        if f is None:
            print(f"FAIL {locale}: missing --{locale}-text-file", file=sys.stderr)
            return 2
        translations[locale] = f.read_text(encoding="utf-8")

    return fanout(args.canonical_en, args.kind, translations=translations)


if __name__ == "__main__":
    sys.exit(main())
