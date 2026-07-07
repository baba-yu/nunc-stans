# 1_daily_update — writer rules (Phase 3 JSON-emitting flow)

Detailed writer regulations for the LLM-driven steps in `1_daily_update`. Phase 3 rewrite: writer prompts now produce **JSON sourcedata** conforming to the schemas in `design/sourcedata-layout.md §JSON schemas (canonical)`. Markdown is NEVER written by the LLM — `render-news-md` (Jinja2) is the single producer of `data/daily-news/<L>/news-YYYYMMDD.md`.

The legacy stream-letter vocabulary is **gone**. There is no separate "title-stream" / "reasoning-stream" / "mid-tier-summary-stream" concept — the prediction is one JSON object with `title` (the one-line title), `body` (the long-form prose), `reasoning` (the explicit field bundle `because`/`given`/`so_that`/`landing`/`plain_language`), and `summary` (the mid-tier prose). The renderer assembles them into the markdown shape the reader sees.

## Per-skill JSON contracts

### `compose-prediction` (one sub-agent per prediction)

Output: a single object matching `predictions.predictions[]` per `design/sourcedata-layout.md`:

```json
{
  "id": "prediction.<sha16>",
  "scope_hint": "tech | business | cross",
  "title": "<one-line title; ≤ 80 chars; lead with the predicted subject + verb; no trigger event, observer, or date as the opening phrase; no scope prefix>",
  "body": "<long-form prose body; multi-sentence; what the prediction says + why; no parser anchors>",
  "reasoning": {
    "because": "<≤ 100 chars: observed precondition>",
    "given": "<≤ 100 chars: structural force>",
    "so_that": "<≤ 120 chars: consequence>",
    "landing": "<≤ 80 chars: when + actor placement>",
    "plain_language": "<≤ 25 words; a 14-year-old would understand>"
  },
  "summary": "<≤ 300 chars; 2-3 sentences typical, 4 hard cap; plain technical prose; no URLs; no scope prefix>"
}
```

Field-level rules:

- **`title` MUST lead with the predicted subject and verb.** The title states the prediction itself — what subject does what — not the catalyst that motivated it. Hard constraints:
  - DO NOT open with the triggering event (e.g. `Mag 7 Q1 earnings reset …`, `Mag 7 prints + FOMC … force …`, `WSJ OpenAI-revenue-miss + Mag 7 print collision triggers …`).
  - DO NOT open with the observer / analyst / publication (e.g. `WSJ Apr 28 …`, `OpenAI Apr 28 WSJ initiates …`).
  - DO NOT open with a date or timing reference. The trigger's date, the publication that flagged it, and any analyst commentary belong in `body` / `reasoning.because` / source citations — never in the leading phrase of the title.
  - The subject is the actor / system / category whose future state is being predicted (e.g. `Local-LLM training stack`, `Big-3 hyperscalers`, `SEC`, `Frontier cyber-AI models`). The verb states the predicted action / state change. A trailing `by <time>` is fine; a leading time is not.
  - GOOD: `Local-LLM training stack hits 70% VRAM reduction baseline by H2 2026`
  - GOOD: `SEC publishes AI-revenue disclosure concept release by Q4 2026`
  - GOOD: `Big-3 hyperscalers ship MCP-server policy enforcement as default by Q4 2026`
  - BAD: `Mag 7 Q1 earnings (Apr 29-30) reset the AI-capex ROI narrative — Q3 2026 sees first hyperscaler …` (leads with trigger event + its date)
  - BAD: `WSJ OpenAI-revenue-miss + Mag 7 print collision triggers SEC + analyst push …` (leads with collision/observer)
  - BAD: `OpenAI Apr 28 WSJ initiates 2026 "AI-revenue disclosure rewrite" — by Q3 2026 …` (leads with observer + date)
  - **Subject choice between `body` and `reasoning.so_that`:** The title's subject MUST match the BODY's narrative center — the technology / project / institution / phenomenon the prediction is ABOUT. Use `so_that` to identify the predicted VERB / state change, not the subject. `so_that`'s grammatical subject is often a downstream consequence-bearer (a hyperscaler that "ships X", a regulator that "publishes Y", an analyst that "covers Z") and using it as the title's lead loses what the prediction is *about*.
    - GOOD: body = "Unsloth 2026 update wave (12x faster MoE, 20% less VRAM)…"; so_that = "A hyperscaler ships a managed Unsloth tier" → `Unsloth lands as hyperscaler-managed fine-tuning service by H2 2026` (subject = Unsloth from body; verb derived from so_that)
    - BAD: same prediction → `Hyperscalers ship managed Unsloth fine-tuning service by H2 2026` (subject from so_that's grammatical actor — loses Unsloth, the body's center)
  - **Smell test for subject specificity:** replace the title's subject with placeholder `X`. Would `X does Y by Z` uniquely identify this prediction from the body? If yes → subject is specific to this prediction (good). If no → subject is generic (`hyperscalers`, `labs`, `regulators`, `agencies`) and you should swap it for the body's actual narrative center.
- **No scope prefix** in any field — `(Tech)`, `(Business)`, `(Mix)`, `（技術）`, `(Tecnología)`, `(Teknikal)` etc. are forbidden.
- **No URLs / no markdown links** in `summary` — citations belong in `news_section.json` and `headlines.json`.
- **No new facts** in `summary` — every claim must be entailed by `body`.
- **`body`** is plain prose. The renderer wraps it in the numbered list item; no need to add `1.`, indentation, or bullet keys yourself.
- **`reasoning.plain_language`** is what the renderer turns into "In plain language: …" — write it as a single sentence, no leading verb required.
- **Acronyms** allowed only if `status='active'` in `glossary_terms`.

The renderer never emits `- because:` / `- given:` / etc. bullet keys, the `**Summary:**` parser anchor, or the `plain_language` keyword. Those internal vocabulary items live in JSON only.

### `compose-headlines-pair` (one sub-agent)

Output: object matching `headlines.json` schema. Both `technical[]` (5 entries) and `plain[]` (5 strings) are required; they pair 1:1 in source order.

- `plain[]` strings: ≤ 60 chars each, ≤ 2 proper-noun tokens, no markdown.
- `technical[i].lead`: short phrase (≤ 80 chars).
- `technical[i].body`: detailed prose, citation-rich.
- `technical[i].citations`: list of `{label, url}` — every URL passes `citation-restriction-check`.

### `compose-change-log` (one sub-agent)

Output: object matching `change_log.json` schema. Each `items[i]` carries `kind` (`new`/`updated`/`continuing`), `headline` (short reference to the news item), and `diff_narrative` (prose explaining how today differs from `vs_date`).

### `compose-news-section` (one sub-agent)

Output: object matching `news_section.json` schema. Each `sections[i].category` becomes a `### <Category>` sub-header in the rendered markdown; each `bullets[i].body` becomes a `- <body>` line, with `citations` rendered as a comma-joined link list at the end.

**Anti-inertia rules (per `design/decisions/ADR-002-news-anti-inertia.md` and `prompts/skills/compose-news-section.md §Anti-inertia rules`):**

- **Continuation cap:** at most 2 of the day's bullets may extend a storyline already present in any of the prior 3 days of `data/daily-news/en/news-*.md`. The remaining 3+ bullets must be either fresh topics (covered topics from `data/reference/news-topics.md` not seen in the prior 3 days) or net-new events on a previously-covered topic. The parent supplies a structured prior-storyline digest to identify continuations.
- **State-change requirement on continuations:** every continuation bullet must center on a fresh state-change event observed on this date — new named entrant, numeric threshold crossing, new actor position, new artifact shipped, or scheduled catalyst date reached. Hold-steady framings ("unchanged through the weekend," "Nth consecutive non-trading day," "doubly/triply weekend-aged hold," "now-N-day-old artifact") must be **dropped**, not written. Under-filling (3 or 4 bullets total) beats inertia-filling.
- **Forbidden lifecycle metadata:** `day-N` storyline numbering, aging vocabulary (`weekend-aged`, `doubly-aged`, `triply-aged`, `N-day-old artifact`, `holiday-equivalent day`), and `Nth consecutive {day,session,non-trading day,weekend day,holiday-equivalent day}` framings as bullet anchors. Full token list lives in `design/sourcedata-layout.md §Naming hygiene → Lifecycle metadata`. `lint-markdown-clean` enforces post-render; the parent schema-validates pre-render and re-prompts the sub-agent on a hit.
- **Context shielding (parent-side, restated for the writer):** the writer will never receive the body of prior `news-*.md` files as continuity context. The parent passes only the structured digest. If the writer feels it lacks context, that absence is intentional — continuity is the inertia driver this rule is correcting.

## Glossary hygiene

The `extract-glossary-candidates` skill handles mechanical extraction. Writer-side: do **not** re-define a term inside the body prose. Repetition is what the glossary layer removes. If a term is unfamiliar to the reader and not yet in `glossary_terms` with `status='active'`, the writer can either (a) inline a 1-clause gloss, or (b) trust the next daily run to promote and define the term.

When `define-glossary-terms` returns a non-empty `pending_definitions` list, fill `quick_def` + `why_it_matters` per the prompt template in `prompts/skills/define-glossary-terms.md`. Refused terms get `status='retired', reviewed_by_human=1`.

## Schema validation gate

Every sub-agent's JSON output is validated at write time against `app/skills/sourcedata_schemas.py`. On schema failure the orchestrator MUST fail-fast and re-prompt the failing sub-agent with the explicit error message — never ship a partial JSON file.

## Topic-coverage hint

For the LLM driving `compose-news-section`: every run must cover the topic list in `data/reference/news-topics.md`. **Unsloth must be searched every run** (not just when news-driven). **Multica only when news-driven**.

## Forbidden token reminder

The lint check `lint-markdown-clean` (Step 14 of the orchestrator) is the structural gate that catches Stream-jargon / parser-anchor leaks. Even though the renderer wraps prose into a deterministic shape, the writer prompts can still inject forbidden tokens INTO the prose body itself (e.g. an LLM that quotes "the **Bridge (Pred ID #N):** language" in a prediction's body). The lint catches this. See `design/sourcedata-layout.md §Naming hygiene` for the full forbidden list.
