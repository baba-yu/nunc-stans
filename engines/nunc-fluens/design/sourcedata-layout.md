# Sourcedata layout — refactoring spec

Spec for separating human-readable markdown from structured pipeline byproducts. Drafted 2026-05-04.

Companion to `design/refactoring.md`. Touches `1_daily_update`, `2_future_prediction`, `extract-needs`, the news/FP parsers, and the locale-fanout skill. Does **not** touch the database schema, the export shape, or the frontend.

## Why

The current corpus has internal-pipeline tokens leaking into human-facing markdown:

- `news-*.md` historically carried `eli14`, `because`/`given`/`so_that`/`landing` Stream-C bullet keys, and `**Summary:**` parser anchors. (Phase 5 renderer fix + Phase 6 super-backfill removed them; the `eli14` field itself was renamed to `plain_language` and is no longer emitted as a literal field-name token in markdown.)
- `future-prediction-*.md` carries `**Bridge (Pred ID #N):**` internal references, `Coherence N/5`, `Remaining gap:` parser tokens, and a large validation table that's really a structured datum rendered as markdown.
- `.jtbd-tmp/` (gitignored, "tmp"-named) is the only home for LLM-extracted Needs JSON — losing it loses the data permanently.
- The legacy code path still calls these "JTBD" in places even though the renamed concept is "Needs".

A reader of `report/en/news-20260504.md` sees coined project-internal vocabulary they can't resolve. A reader of `future-prediction/en/future-prediction-20260504.md` sees opaque numeric IDs. Both files were intended for human consumption, not as pipeline I/O carriers.

## Goal / Non-goals

**Goal:**
1. Markdown files contain **only human-readable prose** with no project-coined terms (`eli14` legacy / `plain_language` field name as a literal token, `JTBD`, `Pred ID`, the legacy stream-letter labels, etc.) and no internal reference IDs.
2. **JSON sourcedata** under `app/sourcedata/` is the canonical structured record for every pipeline stream.
3. Markdown is **rendered from sourcedata** by a deterministic templating step — the LLM never writes markdown directly.
4. The full daily flow stays sub-agent-dispatchable per `0_daily_master.md §Sub-agent dispatch policy`.
5. `cli update --rebuild-from-sourcedata` is reproducible: nuke the DB, re-run, and every `predictions` / `prediction_needs` / `validation_rows` row comes back identically.

**Non-goals:**
- Database schema migration (the `predictions` / `prediction_needs` / `needs_tasks` / `validation_rows` columns stay).
- Export-shape changes (`docs/data/graph-*.json` stays byte-equivalent post-refactor for the same input state).
- Frontend changes (`docs/assets/app.js` requires zero edits).
- Business-logic changes (scoring, dormant-pool detection, Pareto-frontier rules — all unchanged).

## Naming hygiene

Forbidden tokens in **any** markdown file under `report/` or `future-prediction/`, in any locale:

| Category | Forbidden |
|---|---|
| Coined project terms | `eli14` (legacy field name) / `plain_language` (as a literal field-name token; the prose phrase "In plain language" is the approved surface form), the legacy stream-letter labels (the lint-pattern matches `Stream <single-letter>` for any of A B C D E F J K), `JTBD`, `Need(s)` (capitalized as a project-internal type), `Reasoning trace` |
| Internal IDs | `Pred ID #N`, `Need ID #N`, `Bridge ID #N`, prediction hash IDs (`prediction.<sha>`), need hash IDs |
| Parser anchors | `**Summary:**`, `**Bridge (...):**`, `Coherence N/5`, `Remaining gap:`, `- because:`, `- given:`, `- so_that:`, `- landing:`, `- eli14:`, `- plain_language:` (the bullet keys themselves, in either the legacy or the renamed form) |
| Pipeline meta | `(Tech)` / `(Business)` / `(Mix)` / locale equivalents (already forbidden by the existing rule, restated for completeness) |
| Lifecycle metadata (anti-inertia) | `day-N` storyline numbering (e.g. `day-25`, `day-22`), aging vocabulary (`weekend-aged`, `doubly-aged`, `triply-aged`, `N-day-old artifact`, `holiday-equivalent day`), `Nth consecutive {day,session,non-trading day,weekend day,holiday-equivalent day}` for hold-steady framing. These tokens are how the LLM machinically extends a prior-day storyline without a fresh state-change anchor; they are the surface signature of the 5/08→5/25 inertia drift documented in `design/decisions/ADR-002-news-anti-inertia.md`. The renderer never emits these — writer-side avoidance is the single source of truth. |

Approved external-facing equivalents (template renderer uses these):

| Internal | External (markdown surface) |
|---|---|
| `plain_language` value | "In plain language: …" or just rendered as a separate prose sentence |
| `because`/`given`/`so_that`/`landing` 5-tuple | A natural-language paragraph rendered by the template — no bullet keys exposed |
| Mid-tier summary | The first paragraph of the prediction body — no `**Summary:**` marker |
| `**Bridge (Pred ID #N):**` | "On the X prediction (Apr 27): …" — referenced by short_label or natural date, never by hash |
| `Coherence N/5` | A natural prose qualifier: "strong / moderate / weak signal" |
| `support_dimension` keyword | Omitted from prose (the JSON has it; the markdown reader doesn't need it) |
| `## Plain Headlines` section header | Renamed to `## Quick Reads` |

## Directory layout

```
app/
  sourcedata/                                # NEW, git-tracked
    YYYY-MM-DD/
      predictions.json     # 3 predictions: title, body, reasoning bundle, plain_language, summary
      needs.json           # All Needs for that day's predictions
      bridges.json         # Validation rows + bridge_text + support_dimension
      headlines.json       # Plain + technical headlines (paired)
      change_log.json      # Diff bullets vs prior day
      news_section.json    # ## News bullets (citation-bearing prose chunks)
    locales/
      YYYY-MM-DD/
        ja/
          predictions.json # title_ja, body_ja, reasoning_ja (because/given/so_that/landing/plain_language), summary_ja per prediction
          needs.json
          bridges.json
          headlines.json
          change_log.json
          news_section.json
        es/ ...
        fil/ ...
  templates/                                 # NEW, git-tracked
    news.md.j2              # Renders sourcedata/<date>/*.json + locale/<date>/<L>/*.json -> news-YYYYMMDD.md
    future_prediction.md.j2 # Same for future-prediction-YYYYMMDD.md
```

## JSON schemas (canonical)

Schemas use a permissive draft (additionalProperties: false), validated by a Python wrapper before writing to disk.

### `predictions.json`

```json
{
  "date": "2026-05-04",
  "predictions": [
    {
      "id": "prediction.adb89416691d7587",
      "scope_hint": "cross",
      "title": "Hyperscaler-partner enterprise-AI JV template publishes by Q4 2026",
      "body": "<one-paragraph long-form prose, multi-sentence; what the prediction says + why>",
      "reasoning": {
        "because":         "Anthropic + OpenAI both launched parallel enterprise-services JVs in the same May 4 news cycle",
        "given":           "Pentagon-blacklist precedent forces frontier labs to ship a structured commercial-deployment shape outside classified procurement",
        "so_that":         "≥1 hyperscaler partner ships a parallel structured-equity JV with mandatory ethics carveouts + audited revenue share footnote",
        "landing":         "by Q4 2026; ≥1 hyperscaler 8-K filing + ≥1 sibling-template announcement",
        "plain_language":  "After the Pentagon shut Anthropic out, Anthropic and OpenAI both launched investor-funded business arms on the same day — soon a cloud company will copy that shape."
      },
      "summary": "<2-3 sentence technical summary, ≤300 chars, plain technical prose>"
    }
  ]
}
```

Only one field was renamed from the legacy vocabulary — the coined `eli14` became the descriptive `plain_language` (Phase 5 cleanup, applied across schema + ingest + export + frontend). The other reasoning keys (`because` / `given` / `so_that` / `landing`) are reasonable English words that map naturally to the logical structure, so they stay.

JSON and DB now use matching key names — `reasoning.plain_language` JSON maps directly to `predictions.plain_language` DB column with no rename in the ingest layer.

### `needs.json`

Each Need keyed under its parent prediction id; preserves the existing extract-needs JSON shape, plus locale fields move to the per-locale files:

```json
{
  "date": "2026-05-04",
  "by_prediction": {
    "prediction.adb89416691d7587": [
      {
        "actor": "hyperscaler enterprise-AI JV product manager (Microsoft Foundry / AWS Bedrock / Google Vertex)",
        "job": "Draft a structured-equity AI-services JV template…",
        "outcome": "Public 8-K announcement…",
        "motivation": "First mover locks in the enterprise-AI commercial-deployment template…",
        "task": {
          "who": "hyperscaler corp-dev team + GTM enterprise-services lead + outside counsel",
          "what": "negotiate JV term sheet + ethics carveout language + audited revenue-share footnote",
          "where": "joint working sessions between hyperscaler corp-dev + PE/IB partner + outside counsel",
          "when": "May to Q3 2026",
          "why": "Anthropic + Blackstone JV shape is now the canonical enterprise template",
          "how": "8-K filing + earnings-call commentary + dedicated press wire"
        }
      }
    ]
  }
}
```

### `bridges.json`

```json
{
  "date": "2026-05-04",
  "validation_rows": [
    {
      "prediction_ref": {
        "id": "prediction.9ece8ad9898a1325",
        "short_label": "Hyperscaler-AI-lab capital coupling…",
        "prediction_date": "2026-04-26"
      },
      "today_relevance": 5,
      "evidence_summary": "Pentagon May 1-3 8-vendor classified-network deal…",
      "reference_links": [
        {"label": "Defense Scoop - DOD expands classified AI work…",
         "url": "https://defensescoop.com/…"}
      ],
      "bridge": {
        "support_dimension": "given",
        "narrative": "<single-paragraph prose; no Pred ID, no Coherence N/5 token, no Remaining gap: token>",
        "coherence": 5,
        "remaining_gap": "<short prose; what's missing for higher confidence>"
      }
    }
  ]
}
```

### `headlines.json`

```json
{
  "date": "2026-05-04",
  "technical": [
    {
      "lead":     "Anthropic + OpenAI parallel enterprise-services JVs",
      "body":     "<full technical headline body, citation-rich>",
      "citations": [{"label": "...", "url": "..."}]
    }
  ],
  "plain": [
    "Anthropic and OpenAI both launch enterprise AI joint ventures"
  ]
}
```

### `news_section.json`

```json
{
  "date": "2026-05-04",
  "sections": [
    {
      "category": "LLM Workflow / Frontier Lab Commercial Deployment",
      "bullets": [
        {
          "body": "<prose with embedded citations>",
          "citations": [{"label": "...", "url": "..."}]
        }
      ]
    }
  ]
}
```

### `change_log.json`

```json
{
  "date": "2026-05-04",
  "vs_date": "2026-05-03",
  "items": [
    {
      "kind": "new",  // new | updated | continuing
      "headline": "Anthropic + OpenAI parallel enterprise-services JVs",
      "diff_narrative": "<prose explaining how today differs from prior day>"
    }
  ]
}
```

## Skill decomposition

Eight new skills + relocations. Sub-agent dispatch shape per `0_daily_master.md §Sub-agent dispatch policy`.

| Skill | Type | Dispatch | Output |
|---|---|---|---|
| `compose-news-section` | LLM | sub-agent | `app/sourcedata/<date>/news_section.json` |
| `compose-headlines-pair` | LLM | sub-agent | `app/sourcedata/<date>/headlines.json` |
| `compose-prediction` | LLM | one sub-agent **per prediction** (3/day) | adds an entry to `app/sourcedata/<date>/predictions.json` |
| `compose-change-log` | LLM | sub-agent | `app/sourcedata/<date>/change_log.json` |
| `extract-needs` *(existing, relocated)* | LLM | one sub-agent **per prediction** | adds entries to `app/sourcedata/<date>/needs.json` |
| `compose-bridge` | LLM | one sub-agent **per validation row** | adds entries to `app/sourcedata/<date>/bridges.json` |
| `render-news-md` | deterministic (Jinja2) | inline | `report/<L>/news-YYYYMMDD.md` |
| `render-future-prediction-md` | deterministic (Jinja2) | inline | `future-prediction/<L>/future-prediction-YYYYMMDD.md` |
| `translate-sourcedata` | LLM | one sub-agent **per locale** | `app/sourcedata/locales/<date>/<L>/*.json` |
| `ingest-sourcedata` | deterministic | inline | populates `predictions` / `prediction_needs` / `needs_tasks` / `validation_rows` from JSON |

The orchestrator (`1_daily_update.md`) becomes:

```
1. compose-news-section   → news_section.json
2. compose-prediction × 3 → predictions.json
3. compose-headlines-pair → headlines.json
4. compose-change-log     → change_log.json
5. extract-needs × 3      → needs.json
6. citation-restriction-check (deterministic, on JSON.citations[].url union)
7. translate-sourcedata × 3 (ja, es, fil) — each sub translates ALL JSON for the day in its locale
8. render-news-md × 4 (en + 3 locales) — deterministic, inline
9. ingest-sourcedata (deterministic, populates DB from JSON)
10. post-write-integrity (markdown structural check; relaxed — no reasoning-bullet / Summary marker checks needed)
11. post-update-validation (DB shape, locale completeness — unchanged)
```

For `2_future_prediction`:

```
1. compose-validation-rows (LLM, sub-agent) → bridges.json (sans bridge_text/support_dimension)
2. compose-bridge × N (LLM, one sub per row) → fills bridge_text + support_dimension
3. citation-restriction-check
4. translate-sourcedata × 3
5. render-future-prediction-md × 4
6. ingest-sourcedata
7. post-write-integrity
8. post-update-validation
```

## Workflow comparison: before vs after

For one prediction:

| Step | Before | After |
|---|---|---|
| LLM input | News context + writer rules (mixed-format markdown contract) | News context + JSON schema |
| LLM output | Markdown chunk with reasoning bullet keys + `**Summary:**` marker | JSON object matching `predictions.predictions[]` schema |
| Persistence | news_parser.py extracts fields from markdown | ingest-sourcedata reads JSON directly |
| Markdown | Authored by LLM, mixed prose+anchors | Rendered from JSON by Jinja2, prose-only |

## Markdown rendered shape (after)

Example `report/en/news-20260504.md` `## Future` section after refactor:

```markdown
## Future

### 1. Hyperscaler-partner enterprise-AI JV template publishes by Q4 2026

By Q4 2026 the May 4 parallel-JV launch — Anthropic's $1.5B enterprise-AI joint
venture with Blackstone + Hellman & Friedman + Goldman Sachs ($300M each
commitment) + OpenAI's parallel "The Development Company" announcement — combined
with the May 1 8-vendor Pentagon classified-network exclusion forces ≥1 hyperscaler
partner (Microsoft / AWS / Google) to publish a structurally analogous JV template
with mandatory ethics-carveout language + audited AI-services-revenue-share segment
in a 10-Q footnote.

In plain language: after the Pentagon shut Anthropic out, Anthropic and OpenAI both
launched investor-funded business arms on the same day — soon a cloud company will
copy that shape.

### 2. …
```

No reasoning-key bullets, no `**Summary:**` marker, no `plain_language` keyword. The dashboard's Reasoning tab still gets the structured fields via DB → JSON export → frontend.

Example `## Bridge` section after refactor:

```markdown
## Bridge

On the "Hyperscaler-AI-lab capital coupling" prediction (Apr 26): Pentagon's May 1-3
8-vendor classified-network deal (Anthropic explicitly excluded as supply-chain risk
+ 6-month sunset for existing deployments) supports the prediction's *structural
force* — once procurement freezes the laggard, the cohort recouples around the
remaining vendors. Strong signal. The remaining unknown is whether any other lab
gets blacklisted before Q3 2026.

On the "Inference servers as primitive supply chain" prediction (Apr 26): …
```

No `Pred ID #N`, no `Coherence N/5`, no `Remaining gap:` token. The structured data still lives in `bridges.json`.

## Migration phases

### Phase 1 — Spec + .gitignore (this PR)

**Deliverable:** This document + `.gitignore` change to track `app/`.
**Test gate:** User review of this spec.
**Rollback:** Revert single commit.

### Phase 2 — Sourcedata reader path (parallel mode)

Add `app/sourcedata/` reader to ingest. New code path: if `app/sourcedata/<date>/predictions.json` exists, ingest from it; otherwise fall back to existing news_parser.py path. No writer changes yet, no markdown changes yet.

**Deliverable:** `cli update` + new `cli ingest-sourcedata` subcommand. Existing 50 days continue to work via fallback.
**Test gate:**
- All 29 existing pytests pass.
- Round-trip test: take a hand-written `app/sourcedata/2026-05-04/predictions.json`, ingest, verify DB row matches the markdown-derived row byte-for-byte (same `title`, `reasoning_*`, etc.).
- Regression test: `cli update --rebuild` against the existing 50-day corpus produces a DB with byte-equivalent `predictions` / `prediction_needs` / `validation_rows` rows compared to pre-refactor.

### Phase 3 — Renderer + writer flow switch

Build `app/skills/render_news.py` (Jinja2 template). Switch `1_daily_update` Step 2-7 to JSON-emitting sub-agents. Sub-agent prompts no longer reference the legacy stream-letter vocabulary — they just produce JSON conforming to the schema.

`extract-needs` output relocates from `.jtbd-tmp/today-needs-pred-prediction.<pid>.json` to `app/sourcedata/<date>/needs.json` (merged across predictions).

**Deliverable:** Today's daily flow runs end-to-end through new path. The day's markdown files land clean (no Stream tokens). The day's `app/sourcedata/<date>/` directory is fully populated.
**Test gate:**
- `daily-flow-check --strict --date <today>` passes.
- New `lint-markdown-clean` check verifies no forbidden tokens appear in any new `.md` under `report/` or `future-prediction/`.
- `post-update-validation` passes (DB shape unchanged).
- Regenerate today's markdown from sourcedata → byte-equivalent to first generation (deterministic templating proven).

### Phase 4 — Backfill historical corpus

Migration script (`app/skills/migrate_to_sourcedata.py`):
1. Read each existing `news-YYYYMMDD.md` + `future-prediction-YYYYMMDD.md`.
2. Extract titles, reasoning fields, summaries, headlines, change-log entries, and bridges via the existing news_parser.py (one last use of the legacy parsers).
3. Write `app/sourcedata/<date>/*.json` files.
4. For each existing markdown file, regenerate from sourcedata using the new renderer.
5. Verify the regenerated markdown round-trips back to the same JSON.
6. Replace the old markdown with the regenerated clean version (commit as a separate "markdown reformat" PR).

For Needs: read DB `prediction_needs` + `needs_tasks` rows + `.jtbd-tmp/today-needs-pred-*.json` files, dedupe, write to `app/sourcedata/<date>/needs.json`.

**Deliverable:** All 50 days have a complete `app/sourcedata/<date>/` directory; all markdown files are clean; `.jtbd-tmp/` is empty (or contains only smoke-test files moved to `.tmp/`).
**Test gate:**
- `cli update --rebuild-from-sourcedata` (new flag, nukes DB then ingests purely from sourcedata) produces a DB with semantically-equivalent rows to pre-refactor (byte-equivalent for most fields; `prediction_summary` long-form may differ if regenerated, so require equivalent on `title`/`reasoning_*`/`plain_language`/`summary`).
- `docs/data/graph-*.json` is byte-equivalent (frontend zero-impact verified).
- `daily-flow-check --strict` for each of the last 7 days passes.

### Phase 5 — Cleanup

- Delete `news_parser.py` reasoning / mid-tier extraction code (markdown is prose-only, no need).
- Delete `prediction_parser.py` Bridge / `Pred ID #N` extraction code.
- Delete `.jtbd-tmp/` from filesystem and gitignore.
- Update `db.py` docstring: "DB rebuilds from `cli update --rebuild-from-sourcedata`, which is fully reproducible from `app/sourcedata/`."
- Update all writer-rules and orchestrator docs to reflect new skill list.
- **Fully remove the legacy stream-letter vocabulary from every markdown file** in the repo (`design/`, `report/`, `future-prediction/`, READMEs, code comments). These were development-only labels (matched as `Stream <single-letter>`) and should not survive into the long-lived corpus. Replace with descriptive references where needed (e.g., "the reasoning fields" instead of the C label).

**Deliverable:** Codebase converges on two-layer model with no Stream-jargon residue.
**Test gate:** Full pytest pass + 3 consecutive daily-flow-check --strict GREEN runs (Mon-Wed proof of stability) + `grep -r "Stream [A-K]" design/ report/ future-prediction/ README*.md` returns zero hits.

### Phase 6 — Super-backfill (chronological markdown walker)

Phase 4's mechanical backfill produced sourcedata JSON with `reasoning = null`, `summary = null`, and incomplete needs for predictions whose source markdown predated Stream J/C/K. Phase 6 closes that gap by walking the markdown corpus oldest→newest and regenerating the LLM-derived structured fields fresh from each day's markdown body, with prior days' just-backfilled sourcedata as chronological context.

Spec: `design/skills/super-backfill.md` (operator runbook included).
Implementation: `app/skills/super_backfill.py` (CLI: `scan` / `prepare` / `apply` / `commit-day`) + `design/skills/compose-prediction-backfill.md` (the only new sub-skill spec; reuses `compose-bridge` + `extract-needs` + locale-fanout otherwise).

**Deliverable:** every `app/sourcedata/<date>/{predictions,bridges,needs}.json` (and locale fan-out for ja/es/fil) has clean LLM-derived fields. Existing `headlines.json` / `change_log.json` / `news_section.json` are preserved (Phase 4 produced reasonable shapes; v1 doesn't regenerate them unless empty). `readings.json` is deferred to v2.

**Test gate:** all 16 dates' sourcedata schema-valid + ingestable; `pytest -q` still GREEN; DB `PRAGMA integrity_check` ok; per-day sub-agent dispatches log only one-line OK status (parent context never holds the regenerated content).

## Test strategy

**Unit:**
- JSON schema validation for each sourcedata file type.
- Renderer round-trip: `JSON → markdown → no-op (markdown is read-only output)`.
- Sourcedata reader: `JSON → DB row` matches expected.

**Round-trip / equivalence:**
- For each existing day: `markdown → news_parser.py → DB` (legacy) vs `markdown → migrate_to_sourcedata → JSON → ingest_sourcedata → DB` (new) → diff DB rows. Equivalence required on all structured columns.

**Integration:**
- Fake 1-day corpus (sourcedata only, no markdown) → `cli update --rebuild-from-sourcedata` → assert DB shape + JSON export shape.
- Same fake corpus → render markdown → assert markdown matches expected golden file.

**Regression:**
- Frontend smoke: `docs/data/graph-*.json` shape pre/post refactor must be byte-equivalent (or, if dates change, semantic-diff-only).
- Locale columns: every today-row has all 4 locale columns populated post-Phase-3.

## Risks + gotchas

| Risk | Mitigation |
|---|---|
| Phase 4 markdown regeneration loses prose nuance from the original LLM author | Run a manual eyeball on 3-5 days' regenerated markdown before bulk replacement. If significant loss, treat regenerated markdown as **starting point** for human edit, not auto-replace. |
| `app/sourcedata/locales/` × 4 locales × 50 days = 200 JSON files committed in Phase 4 → large diff | Single squashed commit titled "Backfill sourcedata for 2026-04-19 → 2026-05-04". Reviewable as a structural addition, not a logic change. |
| Sub-agent `compose-prediction` produces JSON not matching schema → breaks render | JSON schema validation at write time. On schema failure, sub-agent retries with explicit error feedback. Fail-fast: orchestrator aborts day rather than ship a broken JSON. |
| `extract-needs` JSON merging across 3 sub-agents has race condition | Each sub writes to a per-prediction temp file (`app/sourcedata/<date>/needs.<pid>.json`); deterministic merge step combines them into `needs.json` after all 3 sub-agents finish. |
| Renderer template prose feels mechanical / repetitive | The body field IS LLM-authored prose; only the field labels (e.g., "In plain language: …") are template-controlled. The LLM still writes the substance, just via JSON instead of mixed markdown. |
| Tracking app/ in git pulls in `app/data/analytics.sqlite` | `.gitignore` already excludes `app/data/` (added in Phase 1). Same for `app/__pycache__/`, `app/.pytest_cache/`, `app/tests/__pycache__/`. |

## Decisions (resolved by user 2026-05-04)

1. **Vocabulary**: Only the legacy `eli14` field was renamed (it became `plain_language`). The other reasoning keys (`because` / `given` / `so_that` / `landing`) stay as-is — they're reasonable English words mapping to logical structure, not coined terms.
2. **Markdown structure**: `## Future` items keep the numbered list shape `1. <title>` (no H3 promotion).
3. **`## Plain Headlines` rename**: → `## Quick Reads`.
4. **Migration commit shape** (Phase 4): one squashed commit `Phase 4: backfill sourcedata + regenerate markdown for 2026-04-19→2026-05-04`. (This is implementation reviewability, not a user concern; default chosen.)
5. **Stream vocabulary**: **fully removed** from every markdown file in the repo (`design/`, `report/`, `future-prediction/`, READMEs, code comments). These were development-only labels and should not survive in the long-lived corpus. Phase 5 enforces a `grep` zero-hit check.

## Out of scope for this refactor

- Subtheme removal (refactoring.md §1) — separate ticket.
- `cleanPredictionTitle` prefix-list sharing (refactoring.md §2.1).
- `predictions.title` + `summary` backfill catchup (refactoring.md §2.3).
- Glossary audit retention (refactoring.md §2.4).
- LIST view "all scopes" (refactoring.md §2.5).
- Glossary semantic check throttling (refactoring.md §2.6).

These remain in `refactoring.md` for separate work.
