# ADR-002 — News-section anti-inertia rules

**Status:** Accepted 2026-05-26
**Authors:** Yuki + 2026-05-26 inertia-investigation session
**Affects:** `design/skills/compose-news-section.md`, `design/scheduled/1_daily_update-writer-rules.md`, `design/scheduled/0_daily_master.md` (sub-agent dispatch policy), `design/sourcedata-layout.md` (Naming hygiene), `app/skills/lint_markdown_clean.py`

## Context

The user observed on 2026-05-26 that the rolling 3-day README had been "summarizing the same things over and over." Investigation across the May 2026 news corpus established:

| Date | `news_section.json` bullet count | Content character |
|---|---|---|
| 2026-04-25 | ~85 | Concrete one-time events: NVIDIA $5T close, Tesla Earth Day Plant-Cube giveaway, Hannover Messe 2026 closing day, OpenClaw v2026.4.23 tag, CISA adds 4 to KEV. High topic diversity. |
| 2026-04-28 | ~80 | Same diverse-concrete-event character. |
| 2026-05-05 | 28 | First live run of the JSON-emitting sourcedata refactor (Phase 1-6.5). Still diverse: AMD Q1 print, Cisco-Astrix $400M M&A, Cloudflare Infire engine ship, SGLang CVE patch, Anthropic-FIS AML co-build. |
| 2026-05-08 | 5 | **Template lock-in.** Bullet count drops to a fixed 5 dense paragraphs. Content still fresh: Cerebras IPO opens, NHS England advisory, three hyperscalers ship registries, Unsloth Router-Only LoRA preprint. |
| 2026-05-12 | 5 | 5-bullet template; mild storyline narrowing (FMRB / Indo-Pacific reciprocity / Pydantic AI CVE / Cerebras+Tenstorrent / Unsloth). |
| 2026-05-19 | 5 | Storylines locked to a fixed set: FMRB EO day-N / n8n CVE day-N / Cerebras day-N / Mistral Workflows day-N / arxiv loader-verification cluster. Bullet titles carry `day-N` lifecycle metadata. No fresh events. |
| 2026-05-22 | 5 | Same five storylines, same `day-N` shape. |
| 2026-05-24 | 5 | Memorial Day Saturday. Aging vocabulary appears for the first time (`weekend-aged`, `doubly weekend-aged`). The LLM, with no fresh events to invent across the 3-day market closure, anchors prose to `now-N-day-old artifact` framing. |
| 2026-05-25 | 5 | Memorial Day Monday. `triply-aged` enters the vocabulary. Prose is almost entirely lifecycle metadata about hold-steady states. |

`git log` confirms that between 2026-05-05 and 2026-05-08 **no commits touched `design/skills/compose-news-section.md`, `design/scheduled/1_daily_update-writer-rules.md`, or the news_section.json schema**. The lock-in was emergent, not instructed.

## Diagnosis

The compose-news-section sub-agent's spec is permissive — it lists the schema, trusted-source list, citation-skip URL list, topic-coverage list, and forbidden-token list. It does **not** forbid:

1. **All-continuation bullets.** A day where every one of the 5 bullets is a continuation of a prior-day storyline is schema-valid.
2. **Lifecycle metadata in prose.** `day-N`, `Nth consecutive session`, `weekend-aged`, `triply-aged` framings are not forbidden, so the LLM uses them as the cheap continuity-coherence anchor when no fresh state-change is available.
3. **Hold-steady bullets.** A bullet whose only news is "unchanged through the weekend" / "settled into its third consecutive non-trading day" is schema-valid. There is no requirement that a bullet have an actual state-change event.

Compounding factor: the parent orchestrator reads `last 7 report/en/news-*.md` (per `1_daily_update.md §Inputs / outputs`). That context lives in the parent's working memory and tends to leak into the sub-agent prompt as "prior-day continuity hint," reinforcing storyline carry-over.

The 5/24–5/25 Memorial Day weekend (3-day federal-holiday market closure) amplified all three failure modes simultaneously: no fresh real events to invent + parent passing 7 days of nearly-identical prior news + LLM defaulting to aging-vocabulary scaffolding.

## Decision

Add four explicit anti-inertia rules to the news-section writer flow. The rules are placed at three layers (writer spec, schema-level naming hygiene, lint enforcement) so that a regression at any one layer is caught by another.

### Rule 1 — Continuation cap

Of the 5 bullets in `news_section.json`, **at most 2** may extend a storyline that already appeared in `report/en/news-*.md` for any of the prior 3 calendar days. The remaining 3+ bullets must come from `reference/news-topics.md` topics not covered in any of the prior 3 days, or be net-new events on a covered topic.

Rationale: empirically, mid-May runs had 5-of-5 continuation bullets; pre-lock-in runs (4/25, 5/05, 5/08) routinely surfaced 3+ fresh-angle bullets. The 2-bullet cap matches the observed healthy mix.

### Rule 2 — State-change requirement

Every continuation bullet (those allowed under Rule 1) must center on a **fresh state-change event** observed on the bullet's date. Qualifying state changes:

- A new named entrant joins a cohort (e.g., Switzerland joins the 12-government Mistral reference list, Pydantic AI added to Trail of Bits agent-loader taxonomy)
- A numeric threshold is crossed in either direction (e.g., n8n exposed estate breaks below 1,000 for the first time; Mag-7 cohort probability crosses 95%)
- A new actor takes a public position (e.g., NHS England issues advisory; CISA adds CVE to KEV)
- A new artifact ships (e.g., new arxiv ID, new release tag, new M&A announcement, IPO opens)
- A scheduled event reaches its catalyst date (e.g., deadline T-0, IPO first trading day, analyst day occurs)

**Forbidden continuation framings** (no state change): "holds cleanly through the weekend," "settled into its Nth consecutive day," "unchanged across all weekend-equivalent days," "doubly/triply weekend-aged," "now-N-day-old artifact." A bullet whose only news is the absence of news must be dropped from the JSON entirely — do not write `hold-steady` filler.

### Rule 3 — No lifecycle metadata in prose

Lifecycle-metadata tokens are added to the forbidden-token list in `design/sourcedata-layout.md §Naming hygiene` and the `lint_markdown_clean` enforcement layer. Specifically:

- `day-N` storyline numbering (`day-22`, `day-25`, etc.)
- Aging vocabulary: `weekend-aged`, `doubly-aged`, `triply-aged`, `quadruply-aged`, `N-day-old artifact`, `holiday-equivalent day`
- `Nth consecutive {day,session,non-trading day,weekend day,holiday-equivalent day}` framings whose surrounding clause has no companion state-change content

These are the surface signature of the inertia drift. Removing them mechanically forces the writer toward either fresh framing or dropping the bullet.

### Rule 4 — Sub-agent context shielding

The parent orchestrator dispatching `compose-news-section` **must not pass the body of prior days' `report/en/news-*.md` files into the sub-agent prompt**. The sub-agent receives only:

- The day's topic-coverage list (`reference/news-topics.md`)
- The trusted-source list (`arxiv.org`, `simonwillison.net`, `news.ycombinator.com`, plus topic-specific sources)
- The full `references.txt` URL list (for citation skip)
- The schema for `news_section.json`
- The forbidden-token list (now including lifecycle metadata)
- Rules 1–3 above, restated

If the parent needs to communicate "what storylines exist already so the sub-agent can apply the continuation cap," it does so by passing a **short structured summary** (a JSON list of `{storyline_label, last_seen_date, last_state_change_kind}` for each storyline active in the prior 3 days) — not the prior days' news prose. This prevents the LLM from latching onto prior-day phrasing as continuity scaffolding.

## Consequences

Positive:
- The news section shifts back toward the 4/25–5/08 character (concrete events, varied actors, fresh angles per day).
- Lint enforcement (Rule 3) catches the cheap-continuity tokens automatically; a regression in writer prompts no longer ships silently.
- Rule 4 reduces the parent-context's blast radius into sub-agent prompts.

Negative:
- The validation table (`bridges.json` produced by `compose-validation-rows`) still references the last 7 days of predictions, so the FP section will continue to revisit the same predictions until they land or expire. This ADR does not address FP-side repetition — that is a separate concern (see `design/decisions/ADR-003-fp-prediction-lifecycle.md` if/when authored).
- Some legitimately quiet news days will produce fewer than 5 bullets (3 or 4). That is acceptable; under-filling is preferable to inertia-filling.
- Existing news files (2026-05-08 through 2026-05-25) contain lifecycle metadata that will retroactively fail `lint-markdown-clean` if it is ever re-run against them. The lint runs **per-date** in the daily flow and on rerender, not corpus-wide; corpus-wide re-render is out of scope here.

## Trigger reference

User on 2026-05-26: "readme見るとなんか同じことばっかりまとめてる気がする。なんでか調べて。" → "それなら5/19もだめだよ。そこからずっと同じ話しかしなくなってるじゃん。" The follow-up confirmed the lock-in is older than the Memorial Day weekend artifact and structural rather than incidental.
