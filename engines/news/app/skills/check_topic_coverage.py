"""Topic-coverage gate for the daily news section.

Spec: ``reference/news-topics.md`` (topic list + scope clarifications)
+ ``design/skills/verify-topic-coverage.md`` (the auditor sub-agent).

The validator has three modes, in priority order:

1. **Verification mode (preferred)** — when
   ``app/sourcedata/<date>/verification.json`` exists, read the
   ``verify-topic-coverage`` sub-agent's structured audit. Each topic
   has a ``semantic_verdict`` (covered / uncovered / ambiguous) and a
   ``search_log_alignment`` (consistent / search_log_overreports /
   search_log_underreports). Gate logic: mandatory miss (Unsloth
   uncovered without an underreport flag) → exit 1; alignment deltas →
   WARN; all consistent → exit 0.

2. **Legacy search-log mode** — when only ``search_log.json`` exists
   (no verification.json yet). Reads the writer's self-report directly.
   Kept for backwards compatibility while ``verify-topic-coverage`` is
   being wired in across the codebase.

3. **Heuristic fallback (minimal)** — when neither exists. Only checks
   for **self-anchored identifiers** (CVE-YYYY-N, arxiv 2YYY.NNN,
   NASDAQ:) — strings that are 100%-reliable category signals
   regardless of LLM judgment. Semantic categorization is NOT
   attempted at this layer; that's the verify sub-agent's job.

Mandatory rule (all modes): Unsloth must be searched every run. Exit 1
on confirmed miss.

CLI:

  python -m app.skills.check_topic_coverage --date 2026-05-29
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

# Windows console default is cp1252 which can't encode '≥' / '—'.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, Exception):
    pass


_I = re.IGNORECASE

# Self-anchored identifiers ONLY — strings that are 100%-reliable signals
# regardless of LLM judgment. NOT a list of "important topics" — just a
# minimal fallback for when no verification.json or search_log.json
# exists at all. Semantic categorization (matching new vendors to
# topics) is the verify-topic-coverage sub-agent's job, not regex.
_SELF_ANCHORED: dict[str, list[tuple[str, int]]] = {
    "CVE update on score ≥ 8.0": [
        (r"\bCVE-\d{4}-\d+\b", _I),
        (r"\bCVSS\b", 0),
    ],
    "LLM-related research and papers": [
        (r"arxiv\.org", _I),
        (r"\bArXiv\s+[0-9]{4}\.[0-9]+", _I),
    ],
    "Stock prices and corporate activity": [
        (r"\bNASDAQ:", 0),
        (r"\bNYSE:", 0),
    ],
}

# Full list of topics from reference/news-topics.md §Topic list. The
# verify sub-agent enumerates these in verification.json; the validator
# checks every one is present.
_ALL_TOPICS: list[str] = [
    "LLM Workflow",
    "Multi-profiling for Local LLM (e.g. Multica)",
    "Agent Harness (OpenClaw, NemoClaw, Hermes Agents, etc.)",
    "Platform for Local LLM (vLLM, SGLang, etc.)",
    "Ecosystems for Local LLM Embedded System (Foundry Local, etc.)",
    "Local LLM Models",
    "Local LLM Optimization, Fine-tuning (Unsloth — every run)",
    "Ecosystems for LLM on PaaS (AWS Bedrock, Azure AI Foundry, etc.)",
    "AI Security",
    "CVE update on score ≥ 8.0",
    "Hardware",
    "Physical AI",
    "LLM-related research and papers",
    "Stock prices and corporate activity",
    "Bay Area / SV AI meet-up events",
    "Other standing-out topics",
]

_MANDATORY = {"Local LLM Optimization, Fine-tuning (Unsloth — every run)"}
_NEWS_DRIVEN = {"Multi-profiling for Local LLM (e.g. Multica)"}


# ---------------------------------------------------------------------------
# Mode 1: verification.json (preferred)
# ---------------------------------------------------------------------------


def _validate_verification(verification_path: Path) -> tuple[int, list[str]]:
    """Gate on the verify-topic-coverage sub-agent's structured audit.

    Returns (exit_code, lines_to_print).
    """
    with verification_path.open(encoding="utf-8") as f:
        log = json.load(f)
    verifications = {entry["topic"]: entry for entry in log.get("verifications", [])}

    findings: list[str] = []
    exit_code = 0
    overreports = 0
    underreports = 0

    for topic in _ALL_TOPICS:
        entry = verifications.get(topic)
        tag = (
            " [MANDATORY]" if topic in _MANDATORY
            else " [news-driven]" if topic in _NEWS_DRIVEN
            else ""
        )

        if entry is None:
            findings.append(f"-- {topic}{tag}: NOT IN verification.json (auditor didn't enumerate it)")
            if topic in _MANDATORY:
                exit_code = 1
            continue

        verdict = entry.get("semantic_verdict", "ambiguous")
        alignment = entry.get("search_log_alignment", "unknown")
        reason = entry.get("reason", "")
        matching = entry.get("matching_bullets", [])

        # Mandatory rule: Unsloth must be searched. The auditor's verdict
        # tells us if writer ACTUALLY searched. If verdict=uncovered AND
        # alignment=consistent, the writer claimed searched=true with
        # no fresh state-change — that's fine (searched, dropped). If
        # verdict=uncovered AND alignment=search_log_overreports, the
        # writer claimed coverage but it was hollow — fail. If the
        # auditor flags the writer as not having searched at all for a
        # mandatory topic, fail.
        if topic in _MANDATORY:
            if verdict == "uncovered" and alignment == "search_log_overreports":
                exit_code = 1
                findings.append(f"FAIL {topic}{tag}: verdict={verdict}, alignment={alignment} (mandatory topic — writer over-claimed)")
                continue

        # Alignment deltas → WARN (signal of writer self-report drift)
        if alignment == "search_log_overreports":
            overreports += 1
            findings.append(f"WARN {topic}{tag}: verdict={verdict}, alignment={alignment} (writer over-reported coverage)")
        elif alignment == "search_log_underreports":
            underreports += 1
            findings.append(f"WARN {topic}{tag}: verdict={verdict}, alignment={alignment} (writer missed coverage that's actually in news)")
            if matching:
                findings.append(f"     matching bullets: {matching}")
        else:
            mark = "OK" if verdict == "covered" else ("  " if verdict == "uncovered" else "??")
            findings.append(f"{mark} {topic}{tag}: verdict={verdict}, alignment={alignment}")

        if reason and (alignment != "consistent" or verdict == "ambiguous"):
            findings.append(f"     reason: {reason}")

    summary = []
    covered = sum(1 for t in _ALL_TOPICS if verifications.get(t, {}).get("semantic_verdict") == "covered")
    summary.append(f"")
    summary.append(f"Summary: {covered}/{len(_ALL_TOPICS)} topics covered (semantic verdict)")
    if overreports:
        summary.append(f"WARN: {overreports} topic(s) with search_log_overreports — writer's self-report drifted higher than reality")
    if underreports:
        summary.append(f"WARN: {underreports} topic(s) with search_log_underreports — writer missed real coverage")

    findings.extend(summary)

    if exit_code == 0:
        findings.append("")
        findings.append("OK topic coverage (verification mode)")
    else:
        findings.append("")
        findings.append("FAIL topic coverage — mandatory topic missing or unsearched")

    return exit_code, findings


# ---------------------------------------------------------------------------
# Mode 2: legacy search_log.json (backwards compatibility)
# ---------------------------------------------------------------------------


def _validate_search_log(search_log_path: Path) -> tuple[int, list[str]]:
    """Legacy canonical mode: validate against search_log.json directly.

    Kept while ``verify-topic-coverage`` is being wired in across the
    flow. Once every recent date has a verification.json, this mode
    can be removed.
    """
    with search_log_path.open(encoding="utf-8") as f:
        log = json.load(f)
    searches = {entry["topic"]: entry for entry in log.get("searches", [])}

    findings: list[str] = []
    exit_code = 0

    for topic in _ALL_TOPICS:
        entry = searches.get(topic)
        tag = (
            " [MANDATORY]" if topic in _MANDATORY
            else " [news-driven]" if topic in _NEWS_DRIVEN
            else ""
        )

        if entry is None:
            findings.append(f"-- {topic}{tag}: NOT IN search_log.json (writer didn't enumerate it)")
            if topic in _MANDATORY:
                exit_code = 1
            continue

        searched = bool(entry.get("searched"))
        promoted = bool(entry.get("promoted_to_bullet"))
        hits = entry.get("hits_found", 0)

        if not searched:
            reason = entry.get("reason_skipped", "—")
            findings.append(f"-- {topic}{tag}: searched=false (reason: {reason})")
            if topic in _MANDATORY:
                exit_code = 1
        else:
            mark = "OK" if (promoted or hits > 0) else "  "
            findings.append(f"{mark} {topic}{tag}: searched=true, hits={hits}, promoted={promoted}")

    findings.append("")
    if exit_code == 0:
        findings.append("OK topic coverage (legacy search_log mode — consider upgrading to verification.json)")
    else:
        findings.append("FAIL topic coverage — mandatory topic missing or unsearched")

    return exit_code, findings


# ---------------------------------------------------------------------------
# Mode 3: heuristic fallback (self-anchored identifiers only)
# ---------------------------------------------------------------------------


def _heuristic_self_anchored(news_section_path: Path) -> tuple[int, list[str]]:
    """Minimal fallback when no verification.json or search_log.json.

    Only checks self-anchored identifiers (CVE-YYYY-N, arxiv, NASDAQ:).
    Does NOT attempt semantic categorization — that's the verify
    sub-agent's job. The fallback exits 0 by default; it cannot judge
    mandatory Unsloth coverage without LLM input, so the absence of
    verification.json/search_log.json is itself a process failure
    flagged in the output, not a gate failure.
    """
    with news_section_path.open(encoding="utf-8") as f:
        d = json.load(f)
    haystack_parts: list[str] = []
    for s in d.get("sections", []):
        haystack_parts.append(s.get("category", ""))
        for b in s.get("bullets", []):
            haystack_parts.append(b.get("body", ""))
            for c in b.get("citations", []):
                haystack_parts.append(c.get("label", ""))
                haystack_parts.append(c.get("url", ""))
    haystack = "\n".join(haystack_parts)

    findings: list[str] = []
    findings.append("WARN: neither verification.json nor search_log.json found.")
    findings.append("WARN: running self-anchored-only fallback (3 universal identifier topics).")
    findings.append("WARN: semantic topic coverage is NOT evaluated in this mode.")
    findings.append("WARN: dispatch the verify-topic-coverage sub-agent for full coverage check.")
    findings.append("")

    for topic, patterns in _SELF_ANCHORED.items():
        hit_sample: str | None = None
        for p, flags in patterns:
            m = re.search(p, haystack, flags=flags)
            if m:
                hit_sample = m.group(0)
                break
        if hit_sample:
            findings.append(f"OK {topic} (self-anchored): matched {hit_sample!r}")
        else:
            findings.append(f"-- {topic} (self-anchored): no match")

    # Cannot evaluate mandatory Unsloth without LLM judgment.
    findings.append("")
    findings.append("OK self-anchored fallback complete (mandatory Unsloth not evaluable in this mode)")
    return 0, findings


# ---------------------------------------------------------------------------
# CLI entrypoint
# ---------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--date", required=True, help="YYYY-MM-DD")
    parser.add_argument("--sourcedata-dir", default="app/sourcedata")
    args = parser.parse_args()

    date_dir = Path(args.sourcedata_dir) / args.date
    news_section = date_dir / "news_section.json"
    search_log = date_dir / "search_log.json"
    verification = date_dir / "verification.json"

    if not news_section.exists():
        print(f"FAIL: {news_section} not found")
        return 1

    print(f"check-topic-coverage :: date={args.date}")

    # Mode 1 (preferred): verification.json
    if verification.exists():
        print("  mode=verification (verification.json present — LLM auditor verdict)")
        exit_code, findings = _validate_verification(verification)
        for line in findings:
            print(f"  {line}" if not line.startswith(("OK ", "FAIL ", "WARN", "Summary")) else line)
        return exit_code

    # Mode 2 (legacy): search_log.json only
    if search_log.exists():
        print("  mode=legacy-search-log (search_log.json only — writer self-report)")
        exit_code, findings = _validate_search_log(search_log)
        for line in findings:
            print(f"  {line}" if not line.startswith(("OK ", "FAIL ")) else line)
        return exit_code

    # Mode 3: heuristic fallback (self-anchored identifiers only)
    print("  mode=heuristic-fallback (no verification.json or search_log.json)")
    print(f"  source: {news_section}")
    exit_code, findings = _heuristic_self_anchored(news_section)
    for line in findings:
        print(f"  {line}" if not line.startswith(("OK ", "FAIL ", "WARN")) else line)
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
