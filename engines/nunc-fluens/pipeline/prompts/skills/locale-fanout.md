# Skill: locale-fanout (Phase 3 — JSON-first translation)

Translate the EN canonical sourcedata JSON into JA / ES / FIL siblings. Phase 3 rewrite: what gets translated is now the **JSON sourcedata fields**; the rendered markdown is auto-fanned by re-running the deterministic Jinja2 renderer per locale. Translation only touches JSON field values; markdown is byte-deterministic from the locale-specific JSON.

Shared by `1_daily_update` (after `app/sourcedata/<date>/{predictions,headlines,change_log,news_section,needs}.json` are saved) and `2_future_prediction` (after `app/sourcedata/<date>/{bridges,summary}.json` are saved).

## Why this is its own skill

Both daily flows fan out the same EN canonical JSON into the same 3 sibling locales using the same translation contract. Inlining it twice causes drift in the named-entity-preservation rule + section-header rule (the spec is "EN H2 headers stay literally English; only field values translate"). One skill = one place to update the rule.

## Inputs

| Name | Source | Required |
|---|---|---|
| `date` | ISO date YYYY-MM-DD | yes |
| `kind` | `news` \| `future-prediction` (drives which JSON files are copied + translated) | yes |
| `locale` | `ja` \| `es` \| `fil` | yes |

## Outputs

For `kind=news`:
- `app/sourcedata/locales/<date>/<locale>/predictions.json`
- `app/sourcedata/locales/<date>/<locale>/headlines.json`
- `app/sourcedata/locales/<date>/<locale>/change_log.json`
- `app/sourcedata/locales/<date>/<locale>/news_section.json`
- `app/sourcedata/locales/<date>/<locale>/needs.json`

For `kind=future-prediction`:
- `app/sourcedata/locales/<date>/<locale>/bridges.json`
- `app/sourcedata/locales/<date>/<locale>/summary.json`

The rendered markdown for each locale is produced by a separate skill (`render-news-md` / `render-future-prediction-md`) — locale-fanout does not write markdown directly.

## Translation contract (JSON-side)

> **MANDATORY:** every translate-sourcedata sub-agent MUST also read `design/skills/locale-fanout-calques.md` and apply its JA/ES/FIL naturalness rules. This contract covers STRUCTURE; that file covers NATURALNESS (the EN-calque "重訳" patterns Yuki flagged). `summary.json` + `bridges.json` are the calque hotspot.

For each translatable string field in the EN canonical:

- **Translate the value** into the target locale.
- **Preserve numerics + named entities + ISO dates verbatim** (`$1.5B`, `Anthropic`, `2026-04-26`, `Q4 2026`).
- **Filipino** uses modern tech-news style — Tagalog grammar, English borrow words for technical terms is fine.
- **JSON keys stay literal English** in every locale file. The schemas in `app/skills/sourcedata_schemas.py` validate against the canonical key names; localizing keys would silently drop the row at ingest.

### Identity-key fields (do NOT translate)

- `predictions.predictions[].id` — hashed prediction ID; identity.
- `bridges.validation_rows[].prediction_ref.id` — same.
- `bridges.validation_rows[].prediction_ref.short_label` — the EN canonical short text used by the dormant-pool match logic and the historical scan. Translating it silently breaks that join.
- `bridges.validation_rows[].prediction_ref.prediction_date` — ISO date.
- `headlines.json::technical[].citations[].url` — preserved verbatim.
- `bridges.json::validation_rows[].reference_links[].url` — preserved verbatim.
- All `bridge.support_dimension` values — they stay literal English (`because`/`given`/`so_that`/`landing`/`none`); the renderer turns them into a prose qualifier in the rendered markdown.
- All `change_log.items[].kind` values — literal English (`new`/`updated`/`continuing`).

### Locale-to-EN row pairing at ingest

`app/skills/ingest_sourcedata.py:_ingest_locale_*` pairs each locale row to the EN canonical row by **position within the per-prediction (or per-day) list**, not by any "natural key" like `actor` or `short_label`. Concretely:

- `predictions.json` locale rows: paired by `source_row_index` (the position in the EN `predictions[]` list, recorded at EN ingest time).
- `needs.json` locale rows: paired to EN `prediction_needs` rows in **rowid order** within each `prediction_id`. Earlier versions matched by `actor` value, but the locale-fanout contract translates `actor`, so the join failed in practice. Index pairing is the deterministic equivalent given that locale files are generated FROM EN canonical with the same length and ordering.
- `bridges.json` locale rows: paired to EN `validation_rows` in source order within the `validation_date`.

Implication for sub-agents: **never reorder lists** when emitting the locale file; `predictions[]`, `validation_rows[]`, and each `by_prediction[<pid>][...]` slice MUST preserve the EN canonical's order. Adding/removing entries silently breaks the pairing.

### Forbidden translations (no scope prefix in any locale)

If the EN canonical somehow leaks a `(Tech)` / `(Non-Tech)` / `(Business)` / `(Mix)` etc. prefix into a translatable field (it shouldn't — `1_daily_update` and `2_future_prediction` writer rules forbid it), **the translator must NOT translate that prefix**. Drop it on the floor. The 1:1 translations `(技術)` / `(非技術)` / `(Tecnología)` / `(Teknikal)` / `(Negosyo)` are **forbidden** by this skill's contract. The rendered markdown is also lint-checked for these prefixes (`lint-markdown-clean`); a slipped prefix fails the post-render gate.

## Skill behavior (LLM-side)

Each sub-agent gets the EN canonical JSON files for its kind + this skill's rules + the locale identifier. It returns either the file paths (after writing them via `os.replace` for atomicity) or the JSON dicts for the parent's `write_atomic` call.

The actual LLM call is the orchestrator's responsibility — this skill exposes a `translate_one(canonical_json, locale, kind) -> dict` function the orchestrator wraps with its own writer context.

### Sub-agent dispatch (orchestrator side)

The orchestrator MUST dispatch **one sub-agent per non-EN locale** rather than translating all three locales in its own context. Rationale: translating a full day's JSON corpus 3× inline triples the orchestrator's working set. Each sub-agent gets its own 200K context, receives the EN JSON + this skill's rules + the locale identifier, and returns the file paths it wrote. The parent only holds three short return values — typically a file path each — not the three translated JSON corpora.

### Glossary term definitions

`glossary_terms.quick_def_<locale>` and `why_it_matters_<locale>` are **not** produced by locale-fanout (they are not part of any sourcedata JSON file). They are produced directly by the `define-glossary-terms` LLM fill step inside `1_daily_update`. The locale contract lives in `design/skills/define-glossary-terms.md §LLM fill prompt`.

### Themes

`themes.description_<locale>` and `themes.short_label_<locale>` are **not** produced by locale-fanout. They originate in the bundled `schema.sql` seed blocks and in `apply-schema-edit` operations triggered by `5_weekly_theme_review`.

### Evidence item titles

`evidence_items.title` is the page title of a cited news article — an external artifact sourced verbatim from the web. The locale columns (`title_ja`, `title_es`, `title_fil`) exist in the schema for future use but are intentionally left NULL. Dashboard rendering falls back to the EN title.

## Reference invocation

```bash
# News fanout (orchestrator pseudocode):
for locale in ja es fil; do
  python -m app.skills.translate_sourcedata \
    --date $(date +%Y-%m-%d) \
    --kind news \
    --locale $locale  # writes app/sourcedata/locales/<date>/<locale>/*.json
done

# Then renderer fan-out (per-locale):
for locale in en ja es fil; do
  python -m app.skills.render_news_md \
    --date $(date +%Y-%m-%d) --locale $locale --write
done
```

The implementation lives in `app/skills/locale_fanout.py` (legacy markdown-fanout, retained for the legacy `cli update` path) and a new `app/skills/translate_sourcedata.py` (Phase 3, JSON-side; built lazily as the live daily flow exercises it on 2026-05-05+).
