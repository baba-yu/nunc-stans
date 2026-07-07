# Memory & Taxonomy Maintenance Policy

Status: **implementation in progress**. Daily flow (`design/scheduled/2_future_prediction.md`) and weekly flow (`design/scheduled/4_weekly_memory.md`) are the operational specs. This file holds the WHY and the data contracts.

## 0. Vocabulary

- **Prediction**: a numbered item in a `report/news-YYYYMMDD.md` `## Future` section. Identity is `{news date}-{1-based index}` — e.g. `20260419-1`.
- **Validation**: a row in `future-prediction/future-prediction-YYYYMMDD.md` that re-cites a prediction with a relevance score (1-5) and reference URLs.
- **Active prediction**: a prediction that has appeared in at least one validation row in the last 7 days.
- **Dormant prediction**: a prediction whose ping interval has grown to ≥ 14 days; not retired, just sleeping. Lives in the persistent dormant snapshot.
- **Theme / Category**: hardcoded taxonomy in `app/src/schema.sql`. Spec-driven; never auto-generated.

---

## 1. Memory model — predictions

**Core principle**: every prediction stays in the pool forever. The only thing that changes is **how often it gets re-validated**.

### 1.1 Tier model

| Tier | Last-N relevance pattern | Next ping interval |
|---|---|---|
| Hot | Last seen relevance ≥ 4 within 2 days | 1 day |
| Warm | Last seen relevance 3 within 7 days | 3 days |
| Lukewarm | Last seen relevance 2 OR no signal once | 7 days |
| Dormant | Two consecutive low/no-signal pings | 14 days, then 30 days, then 60 days |

The interval **only grows under quiet** and **resets to 1 day** the moment relevance ≥ 4 is observed (whether by scheduled re-check or by longshot revival).

### 1.2 Identity & state ownership

- A prediction's identity is its **`{news date}-{index}`** ID. The news file is immutable once written, so the ID is stable.
- Hot/Warm/Lukewarm tier is **stateless** — recomputable from the last 7 `future-prediction-*.md` files alone. No persisted state needed.
- Dormant tier **is** the persistent state — kept in `memory/dormant/dormant-YYYYMMDD.md` (latest snapshot wins). This is what makes weekly maintenance bounded; without it, every Sunday would have to rescan every news file ever written.

### 1.3 Daily generation rules (`2_future_prediction.md`)

1. **Always include**: every prediction made in the last 7 days, regardless of past relevance. Fresh predictions need a full week of dense observation.
2. **Include if due**: any dormant prediction whose `next_ping ≤ today` (read from latest dormant snapshot).
3. **Longshot revival**: detect dormant predictions referenced by today's news via the 2-layer mechanism in §1.5. If hit, include in today's table even if not due. Honest relevance score; the tier reset to Hot happens automatically next Sunday because the prediction now appears in a recent future-prediction file.
4. **Never retire**: predictions stay in the pool indefinitely. The interval just gets longer.

Daily flow does not mutate the dormant snapshot. Daily produces validation tables; the weekly job consolidates state.

### 1.4 Dormant snapshot format

```markdown
# Dormant pool — week ending YYYY-MM-DD

## Tier: Dormant — interval ≥ 14 days

| ID | Prediction (short) | Signals | First seen | Last relevance | Next ping | Days quiet |
|---|---|---|---|---|---|---|
| 20260420-3 | "Headless Everything" standardization | headless, browserless, screen-less UI, API-only agent UI, MCP metadata | 2026-04-20 | 1 (4/24) | 2026-05-08 | 2 |
| 20260421-1 | GGUF signature-verification standardization | GGUF, chat_template, Hugging Face signing, Ollama signature, ModelScope verification | 2026-04-21 | 2 (4/24) | 2026-05-01 | 2 |
```

**Columns:**

- **ID**: `{news date}-{index in ## Future}`. Stable across re-runs.
- **Prediction (short)**: 30-60 chars, the same wording the prediction was first cited with in `future-prediction-*.md` (so layer-2 semantic match has consistent text).
- **Signals**: comma-separated keywords / proper nouns / synonyms / category words extracted from the original prediction body in `report/news-*.md`. Lock at the moment a prediction enters the dormant pool. Aim wide rather than narrow — cheaper to false-positive into layer-2 than to miss.
- **First seen**: `news date` of the prediction (= prefix of ID).
- **Last relevance**: `score (date)` of the most recent validation row that referenced this ID.
- **Next ping**: ISO date when this prediction is due for forced re-check, regardless of news content.
- **Days quiet**: integer counter, days since `Last relevance` row date.

The snapshot covers **only** predictions whose interval is ≥ 14 days. Hot/Warm/Lukewarm are reconstructed from the last 7 future-prediction files directly each day.

### 1.5 Longshot revival — 2-layer detection

**Why two layers**: keyword-only matching (layer 1 alone) misses semantic drift — e.g. a "Headless Everything" prediction confirmed by news using "screen-less agent UX" without the word "headless". Semantic-only matching (layer 2 alone) is non-deterministic and easy to under-investigate. Together they bound both miss rate and noise.

**Layer 1 — mechanical (high precision)**:
- Tokenize today's `report/news-YYYYMMDD.md` body.
- For each row in latest dormant snapshot, check if any term in `Signals` appears as a substring or token in today's news.
- Output: candidate hit list with the matching signal as evidence.
- Cost: O(news_tokens × dormant_rows). Trivial even at hundreds of dormant rows.

**Layer 2 — semantic (recall safety net)**:
- Inputs: today's `## Headlines` (5 bullets) + all `### subheadings` (~30-50 lines total) + all dormant `Prediction (short)` lines (one line each).
- Single LLM pass: "List dormant IDs whose short text plausibly relates to any of these headings/headlines."
- Output: candidate hit list with the related heading as evidence.
- Cost: 1 prompt regardless of dormant pool size, since both inputs stay short.

**Union the two layers**, dedupe by dormant ID. Each unique hit becomes a row in today's `future-prediction-YYYYMMDD.md` validation table with:
- Relevance score 1-5 evaluated honestly against the actual news content (not boosted just because it was a longshot — but per §1.1 a relevance ≥ 4 will trigger Hot reset on its own).
- Reference link(s) from the news content that triggered the match.
- The matching signal or heading recorded in the row's evidence cell so the source of revival is auditable.

The dormant snapshot is **not edited** by daily flow. The next weekly run sees the revived prediction in the past 7 days of validation files and removes it from the dormant pool automatically.

---

## 2. Taxonomy maintenance — themes & categories

**Why this exists**: themes/categories are hardcoded in `app/src/schema.sql`. The matcher (IDF token overlap) is best-1, so some themes can end up empty. Themes that never reflect news are dead weight; themes that absorb every prediction are too coarse.

### 2.0 Principle: schema is a current-time view; metrics recompute every run

The taxonomy in `schema.sql` describes **today's** view of the topic space. Themes can be renamed, merged, split, or deleted freely — historical continuity is **not** preserved through the schema. There is intentionally no "retired" status, no alias table, no rename log.

This is safe because metrics (`attention_score`, `realization_score`, `grass_level`, `prediction_count`, etc.) are **fully recomputed** by `update_pages.bat` against the current schema each run. The underlying predictions and evidence are immutable; their attachments to themes/categories are recomputed. So:

- If "Edge LLM" gets renamed to "Local LLM", next week's "Local LLM" trends exactly the way "Edge LLM" was trending — nothing was lost.
- If "Edge LLM" gets merged into "Models", the merged "Models" theme picks up Edge LLM's predictions and reflects their combined activity.
- An old theme name that no longer matches anything in the current matcher run becomes a row with zero attachments — invisible on the dashboard, no cleanup required.

The theme review's job is therefore **diagnostic + advisory**: surface the current shape of the taxonomy, flag pain, propose edits. It never preserves state across renames because there is no state to preserve.

### 2.1 Weekly theme review (Sunday — `design/scheduled/5_weekly_theme_review.md`)

Intent:

- **Empty / underused themes** → suggest deprecate, keyword expansion, or merge.
- **Overpopulated themes** (≥ 6 predictions, multiple sub-topics) → suggest a split.
- **Candidate themes** (entries in DB's `theme_candidates` table, populated by ingest with no-good-match predictions) → propose new theme after 3+ accumulate around a recognizable cluster.

Output is markdown — `memory/theme-review/theme-review-YYYYMMDD.md` (intent: keep weekly artifacts under `memory/`, leave `design/` for specs). Never edits `schema.sql` directly.

#### Recommendation format (required for auto-apply)

`apply-schema-edit` runs **`--mode auto` by default** as of 2026-05-11. Every schema-editing recommendation in `## Recommended actions` MUST carry a fenced action block with the authoritative machine-parseable directive. The surrounding prose stays for human review; the JSON drives apply.

Use either `` ```action `` or `` ```json `` as the fence keyword. Indented under the numbered list item is fine (3+ spaces) — the parser strips indentation.

**`rewrite-description` form** (single-target description swap; locale variants optional):

```action
{
  "kind": "rewrite-description",
  "theme_id": "tech.ai_chip_architecture",
  "new_description_en": "<full replacement description, EN canonical>",
  "new_description_ja": "<...>",
  "new_description_es": "<...>",
  "new_description_fil": "<...>"
}
```

**`add` form** (new theme under an existing category; locale labels recommended, locale descriptions optional):

```action
{
  "kind": "add",
  "theme_id": "tech.<short_snake_id>",
  "category_id": "tech.<existing_category_id>",
  "label_en": "...",
  "short_label_en": "...",
  "tooltip_en": "...",
  "description_en": "...",
  "label_ja": "...",
  "short_label_ja": "...",
  "description_ja": "<optional>",
  "label_es": "...",
  "short_label_es": "...",
  "description_es": "<optional>",
  "label_fil": "...",
  "short_label_fil": "...",
  "description_fil": "<optional>"
}
```

**`log-only` form** (advisory recommendations / investigations that should NOT touch `schema.sql`): omit the action block, OR include `{"kind": "log-only"}` explicitly. Recommendations whose prose matches `Investigate` / `Investigation` / `no schema edit` / `out of scope` are also auto-classified as log-only.

Constraints the proposal author must respect:

- `category_id` MUST already exist in the categories seed block. New categories require their own design discussion per §2.3 — do not propose `add` against a fresh category.
- For `add`, the `theme_id` must be unique. The script refuses (skips) duplicates idempotently.
- Apostrophes inside descriptions are SQL-escaped automatically by the apply script. Other characters pass through verbatim.
- The renderer is structure-blind: bullet keys, internal IDs, or stream-letter labels in the description leak into the dashboard as-is. Keep descriptions to keyword lists + short prose, no parser anchors.

### 2.2 Approval flow

```
[memory/theme-review/theme-review-YYYYMMDD.md]
  ↓  human reviews & approves
[design/themes-additions-YYYYMMDD.md]   ← optional staging file
  ↓  human edits app/src/schema.sql
[git commit + push]
  ↓  next run of update_pages.bat
[DB rebuild + dashboard updates]
```

The app stays a passive consumer of `schema.sql`. Schema edits are PR-reviewable diffs.

### 2.3 Categories

Categories are **even more stable** than themes (12 fixed, broad-bucket overview). New categories are extremely rare and require their own design discussion.

---

## 3. Sunday weekly job (consolidated)

Bounded inputs — the whole point of the dormant snapshot is that the weekly job never has to read history older than the previous snapshot.

```
1. Memory rolling (4_weekly_memory.md)
   - Read previous memory/dormant/dormant-{prev sunday}.md (1 file; if absent → bootstrap mode)
   - Read future-prediction/future-prediction-*.md for last 7 days (≤7 files)
   - Read ## Future sections of report/news-*.md for last 7 days (≤7 files)
   - Compute tier transitions: dormant entries advanced or removed; lukewarm entries pushed to dormant
   - Output: memory/dormant/dormant-YYYYMMDD.md

2. Theme review (deferred to 5_weekly_theme_review.md)

3. (Human turn — schema.sql edits if any)

4. Run app\update_pages.bat to refresh DB & dashboards (existing daily flow)
```

Maximum input on any Sunday = 1 dormant snapshot + 7 future-prediction files + 7 news files = **15 files**. This holds forever, regardless of total project history.

---

## 4. Acceptance criteria for "implemented"

- `memory/dormant/.gitkeep` exists. ✅
- `design/scheduled/4_weekly_memory.md` exists and has been run end-to-end at least once.
- `design/scheduled/2_future_prediction.md` consumes the dormant snapshot and applies 2-layer longshot detection.
- One full Sunday cycle has been run end-to-end and the resulting dormant snapshot has been reviewed by a human.
- No DB schema changes were required.

---

## 5. Open questions — status

| # | Question | Status | Resolution |
|---|---|---|---|
| 1 | Tier thresholds (4/3/2/no-signal) right? | open | Bootstrap-week tier-debug companion produced 12 Hot / 5 Warm / 4 Lukewarm / 0 Dormant on 24 predictions — looks sane. Continue observing as predictions age into Dormant tier; tune thresholds only if false-tier rates become obvious. |
| 2 | Longshot keyword scan efficiency at scale | **closed** | 2-layer mechanism (§1.5). Dormant snapshot row holds explicit `Signals`; layer 2 keeps recall from depending on signal completeness. |
| 3 | Schema rebuild after theme rename/delete | **closed** | No retired status, no alias table. Schema is a current-time view; metrics fully recompute every run (§2.0). Renames / merges / deletes propagate naturally because the predictions/evidence are immutable and the matcher re-attaches them against the current schema each rebuild. |
| 4 | Confirmed ("big-win") predictions need separate "graduated" status? | open | Probably no — keep them in rotation so reality reversal can be detected. Revisit after 1 month of operation. |
| 5 | CLAUDE.md additions | **closed** | Daily/weekly prompts now live in `design/scheduled/*.md`. CLAUDE.md just needs a top-level pointer to that folder. |
| 6 | Identity scheme | **closed** | `{news date}-{1-based index}`, stable because news files are append-only-then-frozen. |
| 7 | Bootstrap behavior | **closed** | First weekly run with no previous dormant snapshot → produces an empty dormant snapshot (all predictions are within 7 days, none can be dormant yet). Bootstrap completed 2026-04-26; spec switched from bootstrap-aware to steady-state-only on the same day. |

---

## 6. 2026-05-02 reconciliation — glossary auto-curation + validation

The 2026-05-02 push landed three skills that interact with this memory model. The dormant-pool side is unchanged; the glossary side is new and operates on a parallel cadence.

### 6.1 Glossary auto-curation (the glossary stream)

`glossary_terms` accumulates jargon outside the dormant pool. Daily flow runs:

1. **`extract-glossary-candidates`** — mechanical regex pass over today's `report/en/news-YYYYMMDD.md` produces shape-matching candidates (`MCP`, `KV-cache`, `MITRE-CNA`, etc.). Idempotent. Bumps `glossary_occurrences` per (term, date).
2. **`define-glossary-terms`** — promotion rule `distinct_days_14d ≥ 3` flips `candidate → active`; quiet-30d rule flips `active → retired` (only when `reviewed_by_human = 0`). Newly-promoted rows surface as `pending_definitions` for the writer LLM to fill `quick_def` + `why_it_matters` + (since 2026-05-02 forward) the `_ja / _es / _fil` locale fan-outs.
3. **`validate-glossary-terms`** (Phase C) — runs after define. Three checks:
   - **form** (Python): empty / > 25 words / > 2 sentences / forbidden quick_def jargon (`leverage`, `synergy`, `paradigm`, `utilize`, `stochastic`) / generic-English term name (`Today`, `Future`, `News`).
   - **dedupe** (Python, conservative): exact alias collision (`fail`) / shorter term ⊂ longer active term (`warn`).
   - **semantic** (LLM-as-judge, orchestrator-driven): does the definition match the term's commonly-understood industry meaning? `mismatch` retires the row.

   Every verdict writes a row to `glossary_audit (term, check_type, verdict, reason, suggested_fix, checked_at)`. A `fail` verdict on form/dedupe (or `mismatch` on semantic) flips the row to `status='retired', reviewed_by_human=1` so the auto-retire-quiet rule in `define-glossary-terms` doesn't churn on it again. The weekly `5_weekly_theme_review` reads `glossary_audit` to surface terms that have repeatedly tripped warnings even though they stayed active — those are signals for a writer prompt-template tweak.

### 6.2 Locale fan-out for glossary

Phase 2-forward (brought into Phase 1 timeline at 2026-05-02): `glossary_terms` now carries `quick_def_{ja,es,fil}` + `why_it_matters_{ja,es,fil}`. Day-0 seed (`reference/glossary.yml`) ships hand-translated for all 11 terms. Auto-promoted candidates' locale fields stay NULL until the writer LLM fills them — frontend coalesces NULLs to EN at export time so hover never shows blank.

**Editing the seed after Day 0.** `reference/glossary.yml` is read on every daily run by `extract-glossary-candidates`, but the default mode is `insert`-only: new YAML rows land, existing rows are never touched. So adding a new term to the YAML auto-flows on the next daily run, but **fixing a translation or definition on an existing term does not** — the SQLite row already exists and gets skipped. To propagate edits, run the skill once manually with `--seed-mode upsert`:

```bash
python3 -m app.skills.extract_glossary_candidates \
  --news-file report/en/news-$(date +%Y%m%d).md \
  --db        app/data/analytics.sqlite \
  --seed-yaml reference/glossary.yml \
  --seed-mode upsert
```

Upsert overwrites YAML-owned fields (aliases, quick_def, why-it-matters, locale fan-out, canonical_link, status, reviewed_by_human) and preserves DB-owned fields (first_seen_date, last_seen_date, occurrences_30d, distinct_days_14d). The asymmetric default exists to keep the candidate→active→retired flow inside SQLite from being silently overwritten by an LLM-edited YAML during routine runs.

### 6.3 Bridge / Needs tie-in to dormant revival

`[REVIVED]` predictions get special handling:

- A `[REVIVED]` validation row in `2_future_prediction` triggers `predictions.huge_longshot_hit_at = <validation_date>` (≤ 14 days dashboard halo).
- Bridge writer rule: when authoring the bridge narrative for a `[REVIVED]` row, the writer must **re-evaluate** the bridge text (the prediction may have drifted since dormancy) rather than copying historical bridges.
- Needs writer rule: if the revived prediction has `prediction_needs` rows, the writer should re-check `needs_tasks.status` — a revived prediction with `status='blocked'` tasks may have flipped to `in_progress` thanks to today's news.

These re-evaluations are writer-rule expectations, not enforced in code today. The `validate-glossary-terms` audit-log pattern (write every check, flag stagnation) is a candidate template for similar Bridge / Needs freshness audits in a future phase if the manual re-evaluation proves leaky.
