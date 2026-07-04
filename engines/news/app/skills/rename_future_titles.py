"""One-shot backfill: rewrite future prediction titles to comply with
post-2026-05-05 title rules.

Spec: ``design/skills/rename-future-titles.md`` (gitignored; the tracked
rationale is ``moushiokuri-rename-future-titles.md`` at repo root).

Two-half pattern (mirrors ``super_backfill``):
  * Python (this module): extraction, schema validation, atomic writes,
    rerender orchestration.
  * Parent agent (Claude): Task-tool sub-agent dispatch, reply collection,
    feeding replies back to ``apply-en`` / ``apply-locale``.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

# Fixed scope: 16 days × 3 predictions = 48 EN entries (one-shot backfill).
_TARGET_DATES: list[str] = [
    (date(2026, 4, 19) + timedelta(days=i)).isoformat() for i in range(16)
]
assert _TARGET_DATES[0] == "2026-04-19"
assert _TARGET_DATES[-1] == "2026-05-04"
assert len(_TARGET_DATES) == 16

_LOCALES: tuple[str, ...] = ("ja", "es", "fil")


def parse_en_reply(line: str) -> dict:
    """Parse a single EN sub-agent reply line.

    Returns one of:
      * ``{"status": "OK", "pid": ..., "new_title": ...}``
      * ``{"status": "KEEP", "pid": ..., "new_title": None}``
      * ``{"status": "FAIL", "pid": ..., "reason": ...}``

    Raises ``ValueError`` for malformed input.
    """
    line = line.rstrip()
    if not line:
        raise ValueError("empty reply")
    if line.startswith("OK "):
        parts = line.split(" ", 2)
        if len(parts) != 3:
            raise ValueError(f"OK reply missing title: {line!r}")
        return {"status": "OK", "pid": parts[1], "new_title": parts[2].rstrip()}
    if line.startswith("KEEP "):
        parts = line.split(" ")
        if len(parts) != 2:
            raise ValueError(f"KEEP reply must be exactly 2 tokens: {line!r}")
        return {"status": "KEEP", "pid": parts[1], "new_title": None}
    if line.startswith("FAIL "):
        parts = line.split(" ", 2)
        if len(parts) != 3:
            raise ValueError(f"FAIL reply missing reason: {line!r}")
        return {"status": "FAIL", "pid": parts[1], "reason": parts[2]}
    raise ValueError(f"unrecognized reply: {line!r}")


_FENCE_RE_JSON = re.compile(r"```(?:json)?\s*(.*?)```", re.DOTALL)


def parse_locale_reply(text: str, expected_pids: list[str]) -> dict[str, str]:
    """Parse a locale sub-agent reply.

    Accepts either a fenced ```json``` code block or a bare JSON object.
    Returns ``{pid: locale_title}``. Raises ``ValueError`` if the reply
    fails to parse, has missing pids, or has unexpected extra pids.
    """
    text = text.strip()
    m = _FENCE_RE_JSON.search(text)
    json_str = m.group(1).strip() if m else text
    try:
        obj = json.loads(json_str)
    except json.JSONDecodeError as e:
        raise ValueError(f"locale reply is not valid JSON: {e}") from e
    if not isinstance(obj, dict):
        raise ValueError(f"locale reply must be a JSON object, got {type(obj).__name__}")
    expected = set(expected_pids)
    got = set(obj.keys())
    missing = expected - got
    if missing:
        raise ValueError(f"missing pid(s): {sorted(missing)}")
    extra = got - expected
    if extra:
        raise ValueError(f"unexpected pid(s): {sorted(extra)}")
    for pid, title in obj.items():
        if not isinstance(title, str) or not title.strip():
            raise ValueError(f"locale title for {pid} must be non-empty string")
    return {pid: obj[pid].strip() for pid in expected_pids}


def scan(repo_root: Path) -> list[dict]:
    """Return ``[{"date", "pid", "old_title"}, ...]`` for all 48 targets."""
    out: list[dict] = []
    for date_iso in _TARGET_DATES:
        path = Path(repo_root) / "app" / "sourcedata" / date_iso / "predictions.json"
        if not path.is_file():
            raise FileNotFoundError(f"missing sourcedata: {path}")
        payload = json.loads(path.read_text(encoding="utf-8"))
        for entry in payload["predictions"]:
            out.append({
                "date": date_iso,
                "pid": entry["id"],
                "old_title": entry["title"],
            })
    return out


# Inlined verbatim from design/scheduled/1_daily_update-writer-rules.md
# §compose-prediction Field-level rules → title section.
_EN_TITLE_RULES = """\
TITLE RULES (from design/scheduled/1_daily_update-writer-rules.md):

- The title MUST lead with the predicted SUBJECT and VERB. The title states the
  prediction itself — what subject does what — not the catalyst that motivated it.

- DO NOT open with the triggering event (e.g. "Mag 7 Q1 earnings reset ...",
  "WSJ OpenAI-revenue-miss + Mag 7 print collision triggers ...").
- DO NOT open with the observer / analyst / publication (e.g. "WSJ Apr 28 ...",
  "OpenAI Apr 28 WSJ initiates ...").
- DO NOT open with a date or timing reference. The trigger's date, the publication
  that flagged it, and any analyst commentary belong in the body / reasoning /
  source citations — never in the leading phrase of the title.

- The subject is the actor / system / category whose future state is being predicted
  (e.g. "Local-LLM training stack", "Big-3 hyperscalers", "SEC", "Frontier
  cyber-AI models"). The verb states the predicted action / state change.

- **Subject choice between `body` and `reasoning.so_that`:** the title's subject
  MUST match the BODY's narrative center — the technology / project / institution /
  phenomenon the prediction is ABOUT. Use `so_that` to identify the predicted
  VERB / state change, not the subject. `so_that`'s grammatical subject is often
  a downstream consequence-bearer (a hyperscaler that "ships X", a regulator that
  "publishes Y", an analyst that "covers Z") — using it as the title's lead loses
  what the prediction is *about*.

  GOOD: body = "Unsloth 2026 update wave (12x faster MoE, 20% less VRAM)…";
        so_that = "A hyperscaler ships a managed Unsloth tier"
        → "Unsloth lands as hyperscaler-managed fine-tuning service by H2 2026"
        (subject = Unsloth from body; verb derived from so_that)
  BAD:  same prediction → "Hyperscalers ship managed Unsloth fine-tuning service
        by H2 2026" (subject from so_that's grammatical actor — loses Unsloth)

- **Smell test for subject specificity:** replace the title's subject with
  placeholder `X`. Would `X does Y by Z` uniquely identify this prediction
  from the body? If yes → subject is specific (good). If no → subject is
  generic ("hyperscalers", "labs", "regulators", "agencies") and you should
  swap it for the body's actual narrative center.

- A trailing "by <time>" is fine; a leading time is not.

- Length: <= 80 chars.
- No scope prefix: (Tech) / (Business) / (Mix) / (技術) / (Tecnología) / (Teknikal) etc.
- Acronyms: only common-knowledge ones (AI, LLM, GPU, SEC, MCP) or expand on first use.

GOOD examples:
  - "Local-LLM training stack hits 70% VRAM reduction baseline by H2 2026"
  - "SEC publishes AI-revenue disclosure concept release by Q4 2026"
  - "Big-3 hyperscalers ship MCP-server policy enforcement as default by Q4 2026"

BAD examples:
  - "Mag 7 Q1 earnings (Apr 29-30) reset the AI-capex ROI narrative ..." (trigger + date)
  - "WSJ OpenAI-revenue-miss + Mag 7 print collision triggers ..." (collision/observer)
  - "OpenAI Apr 28 WSJ initiates 2026 \\"AI-revenue disclosure rewrite\\" ..." (observer + date)

REPLY CONTRACT (one line, exactly one of):
  OK <pid> <new_title>     -- rewrite delivered
  KEEP <pid>               -- existing title already complies
  FAIL <pid> <reason>      -- rewrite impossible
"""


def bundle_en(repo_root: Path, date_iso: str) -> list[dict]:
    """Return EN sub-agent context bundles for one date.

    Each bundle has: pid, prediction_date, old_title, body, so_that,
    landing, title_rules. Per-date count is 3 or 4 depending on the date.
    """
    path = Path(repo_root) / "app" / "sourcedata" / date_iso / "predictions.json"
    payload = json.loads(path.read_text(encoding="utf-8"))
    bundles: list[dict] = []
    for entry in payload["predictions"]:
        bundles.append({
            "pid": entry["id"],
            "prediction_date": date_iso,
            "old_title": entry["title"],
            "body": entry["body"],
            "so_that": entry["reasoning"]["so_that"],
            "landing": entry["reasoning"]["landing"],
            "title_rules": _EN_TITLE_RULES,
        })
    return bundles


# Inlined excerpt from design/skills/locale-fanout.md §Translation contract.
_LOCALE_RULES = """\
LOCALE TRANSLATION RULES (from design/skills/locale-fanout.md):

- Translate the value into the target locale (ja / es / fil).
- Preserve numerics + named entities + ISO dates verbatim:
  $1.5B, Anthropic, OpenAI, 2026-04-26, Q4 2026, H2 2026, GPU, LLM.
- Filipino: modern tech-news style — Tagalog grammar with English borrow words
  for technical terms is fine.
- No scope prefix in any locale ((技術), (Tecnología), (Teknikal) all forbidden).
- Translate ONLY the title strings. Do not modify any other field.
- **Preserve the EN title's subject-leading + trailing-time shape.** Do NOT
  move the `by Q3 2026` / `by H2 2026` / `Q4 2026` time anchor to the front
  of the locale translation even if it is grammatically natural in the locale
  (e.g. Japanese "2026年Q4までに、" or Spanish "Para Q3 2026,"). The locale
  title MUST start with the same subject as the EN canonical; the time anchor
  goes mid-sentence or at the end.
  - GOOD JA: `KVキャッシュ圧縮dtypeが推論スタックのデプロイメント・ノブとして2026年Q4までに出荷される`
  - BAD JA:  `2026年Q4までに、KVキャッシュ圧縮dtypeが…` (date leads — violates rule)

REPLY CONTRACT:
- Success: a single JSON object in a fenced ```json``` block:
    {"<pid_1>": "<title_1>", "<pid_2>": "<title_2>", "<pid_3>": "<title_3>"}
  All input pids must appear exactly. No prose around the block.
- Failure: one line "FAIL <date> <locale> <reason>" (no JSON block).
"""


def bundle_locale(repo_root: Path, date_iso: str, locale: str) -> dict:
    """Return the locale sub-agent context bundle.

    Reads the **already-applied** EN predictions.json (must run after
    apply-en) plus the existing locale predictions.json for terminology
    context. Output bundle has: date, locale, entries (3 or 4 ×
    {pid, en_new_title, locale_old_title}), locale_rules.
    """
    if locale not in _LOCALES:
        raise ValueError(f"unknown locale: {locale!r}; expected one of {_LOCALES}")
    en_path = Path(repo_root) / "app" / "sourcedata" / date_iso / "predictions.json"
    loc_path = (
        Path(repo_root) / "app" / "sourcedata" / "locales" / date_iso
        / locale / "predictions.json"
    )
    en_payload = json.loads(en_path.read_text(encoding="utf-8"))
    loc_payload = json.loads(loc_path.read_text(encoding="utf-8"))
    en_by_id = {e["id"]: e for e in en_payload["predictions"]}
    entries = []
    for loc_entry in loc_payload["predictions"]:
        pid = loc_entry["id"]
        if pid not in en_by_id:
            raise ValueError(f"locale {locale} {date_iso}: pid {pid} not in EN")
        entries.append({
            "pid": pid,
            "en_new_title": en_by_id[pid]["title"],
            "locale_old_title": loc_entry["title"],
        })
    return {
        "date": date_iso,
        "locale": locale,
        "entries": entries,
        "locale_rules": _LOCALE_RULES,
    }


def assemble_dryrun(
    repo_root: Path,
    replies_text: str,
    *,
    generated_at: str | None = None,
) -> dict:
    """Parse EN reply lines + cross-reference scan() to build dry-run JSON.

    ``replies_text``: a string with one reply per line.
    ``generated_at``: ISO timestamp; if None, uses the current UTC time
    (parameter exists so tests can pin it for byte-identical comparison).

    Returns the dict shape suitable for writing to
    ``.tmp/rename-titles-dryrun.json``.
    """
    if generated_at is None:
        generated_at = datetime.now(timezone.utc).isoformat()
    targets = scan(repo_root)
    by_pid: dict[str, dict] = {t["pid"]: t for t in targets}
    entries: list[dict] = []
    seen: set[str] = set()
    for raw in replies_text.splitlines():
        line = raw.strip()
        if not line:
            continue
        parsed = parse_en_reply(line)
        pid = parsed["pid"]
        if pid in seen:
            raise ValueError(f"duplicate pid in replies: {pid}")
        seen.add(pid)
        if pid not in by_pid:
            raise ValueError(f"reply for unknown pid: {pid}")
        target = by_pid[pid]
        if parsed["status"] == "OK":
            entry = {
                "date": target["date"], "pid": pid,
                "old": target["old_title"], "new": parsed["new_title"],
                "status": "OK",
            }
        elif parsed["status"] == "KEEP":
            entry = {
                "date": target["date"], "pid": pid,
                "old": target["old_title"], "new": target["old_title"],
                "status": "KEEP",
            }
        else:  # FAIL
            entry = {
                "date": target["date"], "pid": pid,
                "old": target["old_title"], "new": None,
                "status": "FAIL", "reason": parsed["reason"],
            }
        entries.append(entry)
    missing = set(by_pid) - seen
    if missing:
        raise ValueError(f"missing replies for pids: {sorted(missing)}")
    # Sort by date then pid for deterministic output.
    entries.sort(key=lambda e: (e["date"], e["pid"]))
    return {
        "generated_at": generated_at,
        "scope": f"{_TARGET_DATES[0]}..{_TARGET_DATES[-1]}",
        "entries": entries,
    }


def _hash_id_check(pid: str, prediction_date: str, body: str) -> bool:
    """Recompute prediction_id from (date, body) and compare to pid.

    Mirrors ``app.skills.migrate_to_sourcedata._stable_prediction_id(date_iso, body)``.
    Note: ``app.src.ingest._hash_id`` shadows this with a parameter named
    ``prediction_summary`` but actually receives ``body`` at call time —
    the field-vs-param-name divergence is a known terminology drift in this
    codebase, called out in migrate_to_sourcedata's docstring.
    """
    h = hashlib.sha1("||".join([prediction_date, body]).encode("utf-8")).hexdigest()[:16]
    return pid == f"prediction.{h}"


def _atomic_write_json(path: Path, payload: dict) -> None:
    """Write JSON atomically via mkstemp + os.replace."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=path.name + ".", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
            f.write("\n")
        os.replace(tmp, path)
    except Exception:
        try:
            os.remove(tmp)
        except OSError:
            pass
        raise


def apply_en(repo_root: Path, dryrun_payload: dict) -> dict:
    """Apply EN title changes from a dry-run payload.

    Mutates ``app/sourcedata/<date>/predictions.json`` x 16 in place.
    Validates schema + ID round-trip after writing.

    Returns ``{"updated": <int>, "kept": <int>, "failed": <int>}``.
    """
    from app.skills.sourcedata_schemas import PredictionsFile

    by_date: dict[str, list[dict]] = {}
    for entry in dryrun_payload["entries"]:
        if entry["status"] == "FAIL":
            continue
        by_date.setdefault(entry["date"], []).append(entry)

    counts = {"updated": 0, "kept": 0, "failed": 0}
    for entry in dryrun_payload["entries"]:
        if entry["status"] == "FAIL":
            counts["failed"] += 1
        elif entry["status"] == "KEEP":
            counts["kept"] += 1
        else:
            counts["updated"] += 1

    for date_iso, entries in by_date.items():
        path = (
            Path(repo_root) / "app" / "sourcedata" / date_iso / "predictions.json"
        )
        payload = json.loads(path.read_text(encoding="utf-8"))
        new_by_pid = {e["pid"]: e["new"] for e in entries if e["status"] in ("OK", "KEEP")}
        for pred in payload["predictions"]:
            if pred["id"] in new_by_pid:
                pred["title"] = new_by_pid[pred["id"]]
        # Validate schema BEFORE writing.
        PredictionsFile.from_dict(payload)
        # Validate ID round-trip BEFORE writing.
        for pred in payload["predictions"]:
            if not _hash_id_check(pred["id"], date_iso, pred["body"]):
                raise ValueError(
                    f"ID round-trip failed for {pred['id']} on {date_iso}: "
                    f"body may have been mutated"
                )
        _atomic_write_json(path, payload)
    return counts


def apply_locale_one(
    repo_root: Path,
    date_iso: str,
    locale: str,
    new_titles_by_pid: dict[str, str],
) -> Path:
    """Apply locale title updates for one (date, locale) cell.

    Reads ``app/sourcedata/locales/<date>/<locale>/predictions.json``,
    swaps the title in each prediction, validates schema, atomic-writes
    via ``super_backfill.apply_locale``.
    """
    from app.skills.super_backfill import apply_locale

    path = (
        Path(repo_root) / "app" / "sourcedata" / "locales" / date_iso
        / locale / "predictions.json"
    )
    payload = json.loads(path.read_text(encoding="utf-8"))
    expected_pids = {p["id"] for p in payload["predictions"]}
    if set(new_titles_by_pid.keys()) != expected_pids:
        raise ValueError(
            f"locale {locale} {date_iso}: pid mismatch — "
            f"expected {sorted(expected_pids)}, got {sorted(new_titles_by_pid)}"
        )
    for pred in payload["predictions"]:
        pred["title"] = new_titles_by_pid[pred["id"]]
    return apply_locale(Path(repo_root), date_iso, locale, "predictions", payload)


def rerender(repo_root: Path, *, only_date: str | None = None) -> int:
    """Re-render markdown for one date (or all 16) + reingest + reexport.

    Subprocess-based so each step gets a fresh interpreter and the renderer's
    template caches don't carry stale state.
    """
    dates = [only_date] if only_date else list(_TARGET_DATES)
    for date_iso in dates:
        for locale in ("en",) + _LOCALES:
            cmd = [
                sys.executable, "-m", "app.skills.render_news_md",
                "--date", date_iso, "--locale", locale, "--write",
                "--repo-root", str(repo_root),
            ]
            rc = subprocess.run(cmd, check=False).returncode
            if rc != 0:
                return rc
        cmd = [
            sys.executable, "-m", "app.src.cli", "ingest-sourcedata",
            "--date", date_iso,
        ]
        rc = subprocess.run(cmd, check=False, cwd=str(repo_root)).returncode
        if rc != 0:
            return rc
    if not only_date:
        rc = subprocess.run(
            [sys.executable, "-m", "app.src.cli", "export"],
            check=False, cwd=str(repo_root),
        ).returncode
        if rc != 0:
            return rc
    return 0


def verify(repo_root: Path) -> int:
    """Run all validation gates without making changes.

    Gates:
      1. PredictionsFile.from_dict() per EN file (16) and per locale file (48).
      2. ID round-trip across all EN entries.
      3. lint_markdown_clean per date (16 dates).
      4. post_write_integrity per news markdown (64 files).
      5. daily_flow_check --date 2026-05-04 --strict.
    """
    from app.skills.sourcedata_schemas import PredictionsFile

    # Gates 1 + 2: schema + ID round-trip.
    for date_iso in _TARGET_DATES:
        en_path = Path(repo_root) / "app" / "sourcedata" / date_iso / "predictions.json"
        en_payload = json.loads(en_path.read_text(encoding="utf-8"))
        PredictionsFile.from_dict(en_payload)
        for pred in en_payload["predictions"]:
            if not _hash_id_check(pred["id"], date_iso, pred["body"]):
                print(f"FAIL ID round-trip: {pred['id']} on {date_iso}")
                return 1
        for locale in _LOCALES:
            loc_path = (
                Path(repo_root) / "app" / "sourcedata" / "locales" / date_iso
                / locale / "predictions.json"
            )
            loc_payload = json.loads(loc_path.read_text(encoding="utf-8"))
            PredictionsFile.from_dict(loc_payload)
    print(f"OK schema + ID round-trip ({len(_TARGET_DATES)} dates x 4 locales)")

    # Gate 3: lint per date.
    for date_iso in _TARGET_DATES:
        rc = subprocess.run(
            [sys.executable, "-m", "app.skills.lint_markdown_clean",
             "--date", date_iso, "--repo-root", str(repo_root)],
            check=False,
        ).returncode
        if rc != 0:
            print(f"FAIL lint_markdown_clean for {date_iso}")
            return 1
    print(f"OK lint_markdown_clean ({len(_TARGET_DATES)} dates)")

    # Gate 4: post_write_integrity per news markdown file.
    paths: list[str] = []
    for date_iso in _TARGET_DATES:
        ymd = date_iso.replace("-", "")
        for locale in ("en",) + _LOCALES:
            paths.append(str(
                Path(repo_root) / "report" / locale / f"news-{ymd}.md"
            ))
    cmd = [
        sys.executable, "-m", "app.skills.post_write_integrity",
        "--kind", "news",
    ]
    for p in paths:
        cmd.extend(["--path", p])
    rc = subprocess.run(cmd, check=False).returncode
    if rc != 0:
        print(f"FAIL post_write_integrity")
        return 1
    print(f"OK post_write_integrity ({len(paths)} files)")

    # Gate 5: daily_flow_check.
    rc = subprocess.run(
        [sys.executable, "-m", "app.skills.daily_flow_check",
         "--date", _TARGET_DATES[-1], "--strict",
         "--repo-root", str(repo_root)],
        check=False,
    ).returncode
    if rc != 0:
        print("FAIL daily_flow_check")
        return 1
    print("OK daily_flow_check")
    return 0


def format_dryrun_table(payload: dict) -> str:
    """Return a markdown table of OLD -> NEW for human review."""
    rows = ["| date | pid | status | OLD | NEW |", "|---|---|---|---|---|"]
    for e in payload["entries"]:
        old = (e["old"] or "").replace("|", "\\|")
        new = (e["new"] or "").replace("|", "\\|") if e.get("new") else (e.get("reason") or "")
        rows.append(
            f"| {e['date']} | {e['pid'][:30]} | {e['status']} | {old} | {new} |"
        )
    return "\n".join(rows)


def main(argv: list[str] | None = None) -> int:
    # Force UTF-8 stdout/stderr so non-ASCII titles (e.g. ">=" U+2265, JP/ES
    # characters in locale titles) render on Windows cp1252 consoles too.
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")  # type: ignore[union-attr]
        except (AttributeError, OSError):
            pass
    parser = argparse.ArgumentParser(prog="python -m app.skills.rename_future_titles")
    parser.add_argument("--repo-root", default=".", help="Repo root (default: cwd)")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("scan", help="Print (date, pid, old_title) targets")

    bp = sub.add_parser("bundle", help="Print sub-agent context bundle(s)")
    bp.add_argument("--kind", required=True, choices=["en", "locale"])
    bp.add_argument("--date", required=True)
    bp.add_argument("--locale", default=None, help="Required if --kind locale")

    dp = sub.add_parser("dry-run", help="Assemble dry-run JSON from a replies file")
    dp.add_argument("--replies-file", required=True, type=Path)
    dp.add_argument(
        "--out", default=Path(".tmp/rename-titles-dryrun.json"), type=Path,
        help="Output dry-run JSON path (default: .tmp/rename-titles-dryrun.json)"
    )

    aep = sub.add_parser("apply-en", help="Apply EN titles from dry-run JSON")
    aep.add_argument("--from-file", required=True, type=Path)

    alp = sub.add_parser("apply-locale", help="Apply locale titles for one (date, locale)")
    alp.add_argument("--date", required=True)
    alp.add_argument("--locale", required=True, choices=list(_LOCALES))
    alp.add_argument(
        "--json-file", required=True, type=Path,
        help="JSON file with {pid: locale_title}"
    )

    rp = sub.add_parser("rerender", help="Re-render markdown + reingest + reexport")
    rp.add_argument("--date", default=None, help="Single date (default: all 16)")

    sub.add_parser("verify", help="Run all validation gates without changes")

    args = parser.parse_args(argv)
    repo_root = Path(args.repo_root).resolve()

    if args.cmd == "scan":
        print(json.dumps(scan(repo_root), ensure_ascii=False, indent=2))
        return 0
    if args.cmd == "bundle":
        if args.kind == "en":
            print(json.dumps(
                bundle_en(repo_root, args.date), ensure_ascii=False, indent=2
            ))
        else:
            if not args.locale:
                print("--locale required for --kind locale", file=sys.stderr)
                return 2
            print(json.dumps(
                bundle_locale(repo_root, args.date, args.locale),
                ensure_ascii=False, indent=2,
            ))
        return 0
    if args.cmd == "dry-run":
        replies_text = args.replies_file.read_text(encoding="utf-8")
        payload = assemble_dryrun(repo_root, replies_text)
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(format_dryrun_table(payload))
        print(f"\nWrote {args.out}", file=sys.stderr)
        return 0
    if args.cmd == "apply-en":
        payload = json.loads(args.from_file.read_text(encoding="utf-8"))
        counts = apply_en(repo_root, payload)
        print(json.dumps(counts, indent=2))
        return 0
    if args.cmd == "apply-locale":
        new_titles = json.loads(args.json_file.read_text(encoding="utf-8"))
        path = apply_locale_one(repo_root, args.date, args.locale, new_titles)
        print(f"OK {path}")
        return 0
    if args.cmd == "rerender":
        return rerender(repo_root, only_date=args.date)
    if args.cmd == "verify":
        return verify(repo_root)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
