# Skill: check-topic-coverage

Deterministic topic-coverage validator for the daily news section. Called from `1_daily_update` Step 14.5 (after `lint-markdown-clean`, before `post-update-validation`).

## Why this exists

`reference/news-topics.md` defines the coverage scope: a constant-coverage mandatory topic (Unsloth, every run), a conditional news-driven topic (Multica, only when triggered), and a list of best-effort topics. Up to 2026-05-28, no automated check verified that the `compose-news-section` sub-agent actually honored the spec. Today's run was the trigger for adding the gate — the audit showed AI Security / CVE / Agent Harness had been heavily covered 5/26-5/27 and then silently dropped 5/28, with no automated signal flagging it. The gate doesn't second-guess writer judgment on best-effort topics; it just makes the gap visible.

## Two operating modes

### Canonical (search-log mode)

When `app/sourcedata/<date>/search_log.json` exists, validate against it. This is the future-target mode — the `compose-news-section` sub-agent emits a per-topic audit trail enumerating which topics it searched, what it found, and whether each hit was promoted to a bullet or dropped (with reason). The validator confirms:

- Every topic listed in `reference/news-topics.md` has a corresponding `searches[]` entry
- Mandatory topics (Unsloth) have `searched=true`
- Best-effort topics with `searched=false` get reported (not blocked)

Expected `search_log.json` shape:

```json
{
  "date": "YYYY-MM-DD",
  "searches": [
    {
      "topic": "Local LLM Optimization, Fine-tuning (Unsloth — every run)",
      "searched": true,
      "hits_found": 2,
      "promoted_to_bullet": true
    },
    {
      "topic": "AI Security",
      "searched": true,
      "hits_found": 0,
      "promoted_to_bullet": false,
      "reason_dropped": "no fresh state-change today; prior CVE wave continued but no new incident"
    },
    {
      "topic": "Multi-profiling for Local LLM (e.g. Multica)",
      "searched": false,
      "reason_skipped": "no news-driven trigger in other searches"
    }
  ]
}
```

### Heuristic (output-scan mode)

Fallback when `search_log.json` is absent. Scans `news_section.json` (categories + bullet bodies + citation labels + citation URLs) for topic-keyword regex hits. Honest about the limit: a "covered in output" result only proves the sub-agent surfaced the topic, not that it actively searched the topic and chose to drop it. The validator emits a NOTE clarifying this distinction so the user reads the report with the right caveat.

The keyword patterns are tuples of `(regex, flags)` so proper nouns whose lowercase form is ambiguous (Figure vs six-figure, OLMo, LoRA, DPO, CISA) can be case-sensitive while typical brand tokens stay case-insensitive.

## Inputs / outputs

| Name | Source | Required |
|---|---|---|
| `--date` | YYYY-MM-DD | yes |
| `--sourcedata-dir` | default `app/sourcedata` | optional |
| `--topics-file` | default `reference/news-topics.md` | optional |
| `--references-txt` | default `references.txt` | optional |

Stdout report (canonical mode):
- `OK <topic>` per searched + bullet-promoted topic
- `-- <topic>: searched=false (reason: …)` per skipped topic
- `FAIL` on mandatory miss

Stdout report (heuristic mode):
- `OK <topic>` per topic with a regex hit
- `-- <topic>` per topic without a hit
- Summary line: `N/M topics detected in output (heuristic)`
- WARN block listing uncovered best-effort topics
- WARN line for Multica when `references.txt` mentions it but today's news doesn't

## Exit codes

- `0` — Unsloth covered (canonical: `searched=true`; heuristic: regex hit). Best-effort gaps are WARN-only.
- `1` — Unsloth missing. The orchestrator must re-prompt `compose-news-section` with explicit Unsloth-search instruction.

## Mandatory and conditional topic rules

Per `reference/news-topics.md`:

- **Mandatory** (block on miss): `Local LLM Optimization, Fine-tuning (Unsloth — every run)`.
- **News-driven** (WARN on miss when triggered): `Multi-profiling for Local LLM (e.g. Multica)`. Trigger = Multica appearing in `references.txt` (heuristic mode) or in any other topic's search hits (canonical mode).
- **Best-effort** (WARN only): everything else.

## Known limits of heuristic mode

- A topic the writer searched and legitimately dropped (no fresh state-change today) looks identical to a topic the writer never searched. The user must judge the WARN list against the prior 7 days' coverage to spot inertia drift.
- Keyword false-positives (e.g. "Hardware" matched via "H100" in a research-paper benchmark mention rather than a hardware-bullet) are tightened by requiring brand-vendor anchors (Groq / Cerebras / Tenstorrent / MI4xx) rather than just GPU model numbers.
- The keyword list is in-script (not parsed from `news-topics.md`) so any addition to the topics file needs a corresponding pattern update. The script logs the topic-list it knows so drift is visible.

## Why heuristic is the default ship today

The compose-news-section sub-agent doesn't yet emit `search_log.json`. Wiring that requires a prompt update to the sub-agent contract plus a schema definition in `design/sourcedata-layout.md`. The heuristic gate ships immediately and catches the mandatory case (Unsloth) which is the highest-value check; the canonical mode upgrades the gate when the sub-agent contract is updated.

## CLI

```bash
python -m app.skills.check_topic_coverage --date 2026-05-28
```

## Reply contract

This is a direct skill (not a sub-agent dispatch). It prints to stdout and sets an exit code. No file output.
