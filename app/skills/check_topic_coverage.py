"""Topic-coverage validator for the daily news section.

Spec: ``reference/news-topics.md``. The compose-news-section sub-agent
is supposed to actively search every topic listed there each run; this
skill verifies that it did. Two operating modes:

1. **Canonical (search-log mode).** If
   ``app/sourcedata/<date>/search_log.json`` exists, validate that the
   sub-agent enumerated every topic, marking which were searched and
   which produced bullets. This is the audit-trail mode the writer is
   expected to land into.
2. **Heuristic (output-scan mode).** If no ``search_log.json``, fall
   back to scanning ``news_section.json`` (categories + bullet bodies +
   citation labels + citation URLs) for topic-keyword hits. Honest about
   the limit: "covered in output" only proves the sub-agent surfaced it,
   not that it actively searched the topic and rejected. Distinguishing
   "searched and dropped" from "didn't look" requires the search log.

Mandatory rules (per ``news-topics.md``):

- **Unsloth** must be covered every run. Exit 1 on miss.
- **Multica** is news-driven only. If references.txt or today's
  citations mention Multica but news_section omits it, WARN (don't
  block). If neither references nor news mentions Multica, that's fine.

Best-effort topics: report covered/uncovered as a status line, do not
block. The writer's gather-news context decides which are newsworthy
that day — but the report makes the gap visible so the user can flag
inertia or unexpected omissions.

CLI:

  python -m app.skills.check_topic_coverage --date 2026-05-28
  python -m app.skills.check_topic_coverage --date 2026-05-28 --sourcedata-dir app/sourcedata
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


# Topic names match ``reference/news-topics.md`` top-level bullets. Each
# pattern is a (regex, flags) tuple; flags=0 means case-sensitive (used
# for proper nouns whose lowercase form is ambiguous — e.g. "Figure" vs
# "six-figure"). The default re.IGNORECASE is fine for tokens with one
# canonical spelling (Unsloth, vLLM, Qwen).
_I = re.IGNORECASE
_TOPIC_PATTERNS: list[tuple[str, list[tuple[str, int]]]] = [
    ("LLM Workflow", [
        (r"Mistral Workflows", _I),
        (r"\bn8n\b", _I),
        (r"workflow orchestrat", _I),
        (r"\bagentic workflow\b", _I),
    ]),
    ("Multi-profiling for Local LLM (e.g. Multica)", [
        (r"\bMultica\b", _I),
        (r"multi-profil", _I),
    ]),
    ("Agent Harness (OpenClaw, NemoClaw, Hermes Agents, etc.)", [
        (r"\bOpenClaw\b", _I),
        (r"\bNemoClaw\b", _I),
        (r"\bHermes Agents?\b", _I),
        (r"\bCodex CLI\b", _I),
        (r"\bClaude Code\b", _I),
        (r"agent harness", _I),
        (r"agent loader", _I),
        (r"agent platform", _I),
        (r"\bMCP server\b", _I),
    ]),
    ("Platform for Local LLM (vLLM, SGLang, etc.)", [
        (r"\bvLLM\b", _I),
        (r"\bSGLang\b", _I),
        (r"\bTensorRT-?LLM\b", _I),
        (r"\bTGI\b", 0),  # case-sensitive — TGI is too short to ignore-case safely
    ]),
    ("Ecosystems for Local LLM Embedded System (Foundry Local, etc.)", [
        # Topic scope per `reference/news-topics.md §Topic scope
        # clarifications`: not just Foundry Local — covers any
        # local/edge/on-device LLM runtime/ecosystem.
        (r"Foundry Local", _I),
        (r"\bOllama\b", _I),
        (r"\bLM Studio\b", _I),
        (r"\bllama\.cpp\b", _I),
        (r"\bMLX\b", 0),
        (r"\bROCm\b", _I),
        (r"\bOpenVINO\b", _I),
        (r"Snapdragon AI", _I),
        (r"\bHexagon NPU\b", _I),
        (r"TensorRT-LLM[- ]edge", _I),
        (r"\bMLC LLM\b", _I),
        (r"edge LLM", _I),
        (r"edge[- ]AI", _I),
        (r"on-device inference", _I),
        (r"on-device LLM", _I),
        (r"embedded LLM", _I),
        (r"\bNPU runtime", _I),
        (r"\bNPU inference\b", _I),
    ]),
    ("Local LLM Models", [
        (r"\bQwen[0-9]", _I),
        (r"\bLlama[- ]?[0-9]", _I),
        (r"\bMistral[- ][A-Z]", 0),  # case-sensitive — distinguish model from company
        (r"\bDeepSeek[- ]?[A-Z0-9]", 0),
        (r"\bMixtral\b", _I),
        (r"\bMiniMax\b", _I),
        (r"\bOLMo\b", 0),
        (r"\bPhi[- ]?[0-9]", _I),
        (r"\bGemma\b", _I),
        (r"\bmodel card\b", _I),
    ]),
    ("Local LLM Optimization, Fine-tuning (Unsloth — every run)", [
        (r"\bUnsloth\b", _I),
        (r"\bfine[- ]?tun", _I),
        (r"\bLoRA\b", 0),
        (r"\bDPO\b", 0),
        (r"\bRLHF\b", 0),
        (r"\bTRL\b", 0),
        (r"\bAxolotl\b", _I),
        (r"\bLlama-?Factory\b", _I),
        (r"selective-expert-checkpoint", _I),
    ]),
    ("Ecosystems for LLM on PaaS (AWS Bedrock, Azure AI Foundry, etc.)", [
        (r"\bBedrock\b", _I),
        (r"Azure AI Foundry", _I),
        (r"Vertex AI", _I),
        (r"\bOpenRouter\b", _I),
        (r"Together AI", _I),
        (r"Fireworks AI", _I),
        (r"\bAnyscale\b", _I),
        (r"hosted endpoint", _I),
    ]),
    ("AI Security", [
        (r"zero[- ]trust", _I),
        (r"Defender for Cloud", _I),
        (r"CrowdStrike Falcon", _I),
        (r"MCP firewall", _I),
        (r"agent identity", _I),
        (r"\bAstrix\b", _I),
        (r"Akamai SkyAtlas", _I),
        (r"\bSysdig\b", _I),
        (r"prompt[- ]injection", _I),
    ]),
    ("CVE update on score ≥ 8.0", [
        (r"\bCVE-\d{4}-\d+\b", _I),
        (r"\bCVSS\b", 0),
        (r"\bKEV\b", 0),
        (r"\bMandiant\b", _I),
        (r"\bCISA\b", 0),
    ]),
    ("Hardware", [
        # Require concrete accelerator/chip context — not bare "H100"
        # which leaks into research-paper benchmark mentions. Pair with
        # the dedicated chip-vendor / accelerator brand patterns.
        (r"\bGroq\b", _I),
        (r"\bCerebras\b", _I),
        (r"\bTenstorrent\b", _I),
        (r"\bLPU[- ]?v?[0-9]", 0),
        (r"\bCS-?[0-9]\b", 0),
        (r"\bMI[34]\d{2}\b", 0),
        (r"\bGB200\b", 0),
        (r"\bBlackwell\b", _I),
        (r"\bRubin\b", _I),
        (r"\bHelios\b", _I),
        (r"\bSXM[0-9]\b", 0),
    ]),
    ("Physical AI", [
        # Proper nouns only — avoid lowercase fallthrough like "figure"
        # matching "six-figure-equivalent".
        (r"\bhumanoid\b", _I),
        (r"\bApptronik\b", _I),
        (r"\bApollo Gen", _I),
        (r"\bOptimus\b", 0),
        (r"\bFigure\b(?!\s*-)", 0),  # capital F, not followed by hyphen
        (r"\bSanctuary AI\b", 0),
        (r"\bUnitree\b", _I),
        (r"\bBoston Dynamics\b", _I),
        (r"\bAtlas (?:robot|humanoid|commercial)", _I),
    ]),
    ("LLM-related research and papers", [
        (r"arxiv\.org", _I),
        (r"\bArXiv\s+[0-9]{4}\.[0-9]+", _I),
        (r"\bpreprint\b", _I),
        (r"\bArXiv submission\b", _I),
    ]),
    ("Stock prices and corporate activity", [
        (r"\bNASDAQ:", 0),
        (r"\bNYSE:", 0),
        (r"\bIPO\b", 0),
        (r"\bGoldman Sachs\b", _I),
        (r"\bMorgan Stanley\b", _I),
        (r"\bBloomberg\b", _I),
        (r"\bReuters\b", _I),
        (r"closed (?:Wednesday|Thursday|Tuesday|Monday|Friday) at \$", _I),
        (r"twelve-month target", _I),
        (r"\banalyst\b", _I),
    ]),
    ("Bay Area / SV AI meet-up events", [
        # Topic scope per `reference/news-topics.md §Topic scope
        # clarifications`: shorthand for "AI industry event coverage" —
        # vendor-hosted events, conferences with AI tracks, hackathons,
        # Bay Area meet-ups. Not just SF-geographic events.
        #
        # CRITICAL: patterns must include event-ness. A bare vendor name
        # like `\bZenity\b` matches every Zenity mention (most are CVE /
        # security news, not events) — that's a false positive for this
        # topic. Require the vendor name to co-occur with an event token
        # (Summit / DevDay / Conference / forum / hackathon / etc.) or
        # use a known event brand name directly.
        #
        # Generic meet-up / hackathon / track tokens
        (r"meet[- ]?up", _I),
        (r"\bhackathon\b", _I),
        (r"AI Village", _I),
        (r"AI Track\b", _I),
        # Known event brands (self-anchored — the name itself is the event)
        (r"AI Engineer Summit", _I),
        (r"AI Builders", _I),
        (r"AI Tinkerers", _I),
        (r"\bDevDay\b", _I),
        (r"GitHub Universe", _I),
        (r"Snowflake Summit", _I),
        (r"Data\+AI Summit", _I),
        (r"Databricks (?:Summit|Data\+AI)", _I),
        (r"re:Invent", _I),
        (r"\bRSA Conference\b", _I),
        (r"\bRSAC\b", 0),
        (r"DEF ?CON", 0),
        (r"Black Hat", _I),
        (r"Latent Space (?:meet|event)", _I),
        # Vendor name + event token (require co-occurrence within ~50 chars).
        # Examples: "Zenity Summit 2026", "Zenity hosted a developer day".
        # Add new vendors here as they show up hosting AI events.
        (r"\bZenity\b[^.\n]{0,60}\b(?:Summit|Conference|Forum|DevDay|hackathon|event|workshop|webinar|launch|day)\b", _I),
        (r"\b(?:Anthropic|OpenAI|Google|Microsoft|Meta|Cohere|Mistral)\b[^.\n]{0,60}\b(?:Summit|DevDay|Connect|launch event|developer (?:event|day|conference)|public event)\b", _I),
        # Generic "<Vendor> <event-type>" — broader fallback
        (r"\b(?:annual|launch|developer|customer|partner) (?:summit|conference|event|day)\b", _I),
        (r"\bdev[ -]?conference\b", _I),
    ]),
]

_MANDATORY = {"Local LLM Optimization, Fine-tuning (Unsloth — every run)"}
_NEWS_DRIVEN = {"Multi-profiling for Local LLM (e.g. Multica)"}


def _load_news_section_haystack(news_section_path: Path) -> str:
    with news_section_path.open(encoding="utf-8") as f:
        d = json.load(f)
    parts: list[str] = []
    for s in d.get("sections", []):
        parts.append(s.get("category", ""))
        for b in s.get("bullets", []):
            parts.append(b.get("body", ""))
            for c in b.get("citations", []):
                parts.append(c.get("label", ""))
                parts.append(c.get("url", ""))
    return "\n".join(parts)


def _detect(haystack: str, patterns: list[tuple[str, list[tuple[str, int]]]]) -> dict:
    out: dict[str, dict] = {}
    for topic, pats in patterns:
        hit_pattern: str | None = None
        sample: str | None = None
        total = 0
        for p, flags in pats:
            m = re.search(p, haystack, flags=flags)
            if m:
                total += 1
                if sample is None:
                    sample = m.group(0)
                    hit_pattern = p
        out[topic] = {
            "covered": total > 0,
            "pattern_hits": total,
            "sample": sample,
            "hit_pattern": hit_pattern,
        }
    return out


def _references_contains_multica(references_txt: Path) -> bool:
    if not references_txt.exists():
        return False
    text = references_txt.read_text(encoding="utf-8", errors="replace")
    return bool(re.search(r"\bMultica\b", text, flags=re.IGNORECASE))


def _validate_search_log(log: dict, date: str) -> tuple[int, list[str]]:
    """Canonical mode: enumerate every topic in the log, check mandatory + flags."""
    findings: list[str] = []
    exit_code = 0
    searches = {entry["topic"]: entry for entry in log.get("searches", [])}
    known = [t for t, _ in _TOPIC_PATTERNS]
    for topic in known:
        entry = searches.get(topic)
        if entry is None:
            findings.append(f"-- {topic}: NOT IN search_log.json (sub-agent didn't enumerate it)")
            if topic in _MANDATORY:
                exit_code = 1
            continue
        searched = bool(entry.get("searched"))
        promoted = bool(entry.get("promoted_to_bullet"))
        hits = entry.get("hits_found", 0)
        tag = " [MANDATORY]" if topic in _MANDATORY else (" [news-driven]" if topic in _NEWS_DRIVEN else "")
        if not searched:
            findings.append(f"-- {topic}{tag}: searched=false (reason: {entry.get('reason_skipped','—')})")
            if topic in _MANDATORY:
                exit_code = 1
        else:
            mark = "OK" if (promoted or hits > 0) else "  "
            findings.append(f"{mark} {topic}{tag}: searched=true, hits={hits}, promoted={promoted}")
    return exit_code, findings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--date", required=True, help="YYYY-MM-DD")
    parser.add_argument("--sourcedata-dir", default="app/sourcedata")
    parser.add_argument("--topics-file", default="reference/news-topics.md")
    parser.add_argument("--references-txt", default="references.txt")
    args = parser.parse_args()

    date_dir = Path(args.sourcedata_dir) / args.date
    news_section = date_dir / "news_section.json"
    search_log = date_dir / "search_log.json"

    if not news_section.exists():
        print(f"FAIL: {news_section} not found")
        return 1

    print(f"check-topic-coverage :: date={args.date}")

    # Canonical mode
    if search_log.exists():
        print("  mode=canonical (search_log.json present)")
        with search_log.open(encoding="utf-8") as f:
            log = json.load(f)
        exit_code, findings = _validate_search_log(log, args.date)
        for line in findings:
            print(f"  {line}")
        if exit_code == 0:
            print("\nOK topic coverage (canonical)")
        else:
            print("\nFAIL topic coverage — mandatory topic missing or unsearched")
        return exit_code

    # Heuristic mode
    print("  mode=heuristic (search_log.json absent — output-scan fallback)")
    print(f"  source: {news_section}")
    haystack = _load_news_section_haystack(news_section)
    coverage = _detect(haystack, _TOPIC_PATTERNS)

    multica_topic = "Multi-profiling for Local LLM (e.g. Multica)"
    multica_in_news = coverage[multica_topic]["covered"]
    multica_news_driven_trigger = _references_contains_multica(Path(args.references_txt))

    mandatory_fail: list[str] = []
    best_effort_uncovered: list[str] = []
    news_driven_warns: list[str] = []

    for topic, _ in _TOPIC_PATTERNS:
        info = coverage[topic]
        mark = "OK" if info["covered"] else "--"
        sample = f"  (matched: {info['sample']!r})" if info["sample"] else ""
        tag = (
            " [MANDATORY]" if topic in _MANDATORY
            else " [news-driven]" if topic in _NEWS_DRIVEN
            else ""
        )
        print(f"  {mark} {topic}{tag}{sample}")
        if not info["covered"]:
            if topic in _MANDATORY:
                mandatory_fail.append(topic)
            elif topic in _NEWS_DRIVEN:
                if multica_news_driven_trigger and not multica_in_news:
                    news_driven_warns.append(
                        f"{topic}: referenced in references.txt but not surfaced today"
                    )
            else:
                best_effort_uncovered.append(topic)

    covered_n = sum(1 for v in coverage.values() if v["covered"])
    print(f"\nSummary: {covered_n}/{len(coverage)} topics detected in output (heuristic)")

    if mandatory_fail:
        print(f"\nFAIL mandatory topic miss: {mandatory_fail}")
        if best_effort_uncovered:
            print(f"WARN best-effort uncovered: {len(best_effort_uncovered)}")
            for t in best_effort_uncovered:
                print(f"  - {t}")
        return 1

    if best_effort_uncovered:
        print(f"\nWARN best-effort topics uncovered today: {len(best_effort_uncovered)}")
        for t in best_effort_uncovered:
            print(f"  - {t}")
    if news_driven_warns:
        print("\nWARN news-driven triggers without coverage:")
        for w in news_driven_warns:
            print(f"  - {w}")

    print(
        "\nNOTE: heuristic mode cannot distinguish 'searched and dropped'"
        " from 'didn't look'. Canonical validation requires the"
        " compose-news-section sub-agent to emit"
        " app/sourcedata/<date>/search_log.json with a per-topic"
        " {searched, hits_found, promoted_to_bullet, reason_*} record."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
