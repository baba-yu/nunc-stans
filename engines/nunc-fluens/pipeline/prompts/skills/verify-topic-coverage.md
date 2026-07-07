# Skill: verify-topic-coverage

LLM sub-agent that audits `compose-news-section`'s self-reported topic coverage. Called from `1_daily_update` Step 14.5 (after `lint-markdown-clean`, before `check-topic-coverage` deterministic gate at Step 14.6).

## Why this exists

The `compose-news-section` sub-agent writes both `news_section.json` (the visible bullets) and `search_log.json` (its per-topic audit trail: searched / hits_found / promoted_to_bullet / reason_dropped). Up to 2026-05-29 the validator (`check_topic_coverage.py`) trusted `search_log.json` in canonical mode and fell back to brittle regex pattern matching in heuristic mode.

The regex fallback has a structural ceiling: it cannot semantically classify novel news. If a new vendor (say "VolcanoCoder") releases an open-weight local LLM and the bullet doesn't contain generic phrases like `model card` / `Apache 2.0` / a known family token, regex misses it. Listing every possible future vendor in the regex is whitelist anti-pattern (see [[project_topic_coverage_gate]] for the Zenity / Bay Area meetup incident).

This skill replaces regex semantic detection with LLM-as-judge: an independent auditor sub-agent reads the news + the writer's self-report + the topic spec (the rubric), and emits a structured verdict per topic. The validator at Step 14.6 then trusts the auditor's structured output.

## Sub-agent context (parent supplies)

- `data/sourcedata/<date>/news_section.json` (today's bullets — what the user sees)
- `data/sourcedata/<date>/search_log.json` (writer's self-report — what the writer claims they searched / found / promoted)
- `data/reference/news-topics.md` (topic list + §Topic scope clarifications table — the **rubric**)
- The date string `<date>`

## Sub-agent task

The auditor's perspective is deliberately distinct from the writer's:

- **Writer (compose-news-section)**: "What's newsworthy today across these topics? Which bullets should I write?"
- **Auditor (verify-topic-coverage)**: "Given these bullets + the writer's claims about coverage, is the coverage consistent with the topic spec's *semantic* scope?"

Different prompts → no self-confirmation. Same model is fine; the prompt distinction is what carries the audit signal.

### Auditor prompt (paraphrased — the orchestrator dispatches with this shape)

> You are a topic-coverage auditor for a daily AI news brief. You are NOT writing news; you are auditing what the writer produced.
>
> Inputs:
>
> - `news_section.json` — what the writer actually shipped today
> - `search_log.json` — the writer's per-topic self-report
> - `news-topics.md` — the topic spec including the §Topic scope clarifications table. The clarifications table is your *rubric* — read it carefully. **The brand examples in topic names are illustrative not exhaustive.** A new vendor doing the same kind of activity counts toward the parent topic.
>
> For each topic listed in `news-topics.md` §Topic list, judge two things:
>
> 1. **Semantic verdict**: does today's `news_section.json` actually contain any bullet that semantically belongs to this topic? Apply the §Topic scope clarifications rubric. Don't filter by which specific vendor — filter by the *kind* of news (chip-ness / robot-ness / event-ness / security-ness / model-release-ness / etc.).
>    - `covered` — at least one bullet semantically belongs
>    - `uncovered` — no bullet semantically belongs
>    - `ambiguous` — borderline; explain in `reason`
>
> 2. **Search-log alignment**: does the writer's self-report in `search_log.json` match your semantic verdict?
>    - `consistent` — writer's `promoted_to_bullet` / `searched` flags match the actual coverage
>    - `search_log_overreports` — writer claims `promoted_to_bullet=true` but no bullet actually fits this topic semantically (the writer was over-eager in self-categorization)
>    - `search_log_underreports` — writer claims `hits=0` or didn't surface anything, but one of the bullets actually does fit this topic semantically (the writer missed a coverage)
>
> Write the verdict to `data/sourcedata/<date>/verification.json`.

## Required output

`data/sourcedata/<date>/verification.json`:

```json
{
  "date": "YYYY-MM-DD",
  "verifications": [
    {
      "topic": "<exact topic name from news-topics.md §Topic list>",
      "semantic_verdict": "covered" | "uncovered" | "ambiguous",
      "matching_bullets": ["<news_section.sections[].category string>", ...],
      "search_log_alignment": "consistent" | "search_log_overreports" | "search_log_underreports",
      "reason": "<one to two sentence explanation in prose>"
    }
  ]
}
```

Every topic from §Topic list must appear in `verifications[]` — same enumeration discipline as `search_log.json`. If a topic was skipped entirely by the writer (`searched=false` with valid reason like Multica-news-driven-only), the auditor marks `semantic_verdict=uncovered, search_log_alignment=consistent` and notes the writer's stated reason.

## Mandatory and conditional topic rules (per news-topics.md)

The auditor must apply these gating rules:

- **Unsloth (constant-coverage)**: the writer's `searched=true` is required. If the writer reports `searched=false`, the auditor marks `search_log_overreports` (because the spec says it must be searched every run). The Step 14.6 validator will exit 1 on this.
- **Multica (news-driven-only)**: if no other bullet's content semantically references Multica, the auditor accepts `searched=false` as `consistent`. If a bullet does reference Multica but `search_log` says `searched=false`, the auditor marks `search_log_underreports` (writer missed the news-driven trigger).
- **`Bay Area / SV AI meet-up events` (carry-forward exception, per compose-news-section §Anti-inertia Rule 5)**: this topic explicitly waives ADR-002 Rules 1 + 2. The writer is expected to carry forward yesterday's still-upcoming events even with no fresh state-change. The auditor must:
  1. Accept a carry-forward bullet (events matching yesterday's bullet, minus any whose date has passed) as `semantic_verdict=covered, search_log_alignment=consistent`. Do NOT mark it as `search_log_overreports` for lacking fresh state-change.
  2. Flag `search_log_underreports` if today's bullet drops an event that was upcoming yesterday AND is still upcoming today (the writer should have carried it forward).
  3. Flag a real error (`search_log_overreports`) if today's bullet mentions a past/closed event as the bullet's center (citation context is fine).
  Past events that have already occurred are allowed only as citation context in another bullet, not as the events-bullet's center.
- **All other topics**: best-effort. The auditor's job is purely to flag the alignment delta; the validator at Step 14.6 surfaces these as WARN, not as a gate failure.

## Parent post-processing

Parent reads `verification.json` via `check_topic_coverage.py --date <date>` (the deterministic gate at Step 14.6). Gate logic:

- MANDATORY topic (Unsloth) with `semantic_verdict=uncovered` AND `search_log_alignment != search_log_underreports` → exit 1 (mandatory miss)
- Any topic with `search_log_overreports` or `search_log_underreports` → WARN (alignment delta surface; signals writer's self-report drift)
- All `consistent` → exit 0

## Self-confirmation mitigation

Because the auditor is the same model class as the writer, the prompt distinction does the work:

- Auditor prompt opens with **"You are an auditor, not a writer"** — explicit role separation
- Auditor's only inputs are the writer's outputs + the rubric — the auditor doesn't see the writer's reasoning chain or scratch work
- Auditor's output schema is *structurally different* from the writer's (verdicts + alignment flags, not bullets + search log) — different shape forces different reasoning
- If self-confirmation drift becomes a problem in practice, the upgrade path is to run the auditor on a different model (writer = sonnet, auditor = opus) or with a different temperature

## Reply contract

Sub-agent reply: a one-line `OK <path>` or `FAIL <reason>`. Do NOT paste the JSON content back to the parent — the parent reads it from the file.

## Dispatch policy (per `0_daily_master.md §Sub-agent dispatch policy`)

| Step | Dispatch shape |
|---|---|
| `1_daily_update` Step 14.5 — verify-topic-coverage | 1 sub-agent. Inputs: 2 JSON paths + 1 markdown path + date. Reply is OK + path only. No content paste-back. |
