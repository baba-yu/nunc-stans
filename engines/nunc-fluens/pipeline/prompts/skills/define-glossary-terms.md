# Skill: define-glossary-terms

Promote `glossary_terms` rows from `status='candidate'` to `status='active'` once they hit the popularity threshold, and retire stale `active` rows that haven't been seen in ≥ 30 days. Companion skill to `extract-glossary-candidates` (the glossary stream).

## Why this is its own skill

Promotion + retirement is **state-only** logic against the SQLite table. Definition generation (`quick_def`, `why_it_matters`) requires the writer's LLM context. Splitting them lets:
1. The Python pass run cheaply, deterministically, and without an LLM call.
2. The orchestrator hand the resulting list of newly-promoted terms to the writer's LLM in a single batched prompt.
3. The promotion happen in `1_daily_update`, but the LLM definition fill can be deferred to the weekly review (`5_weekly_theme_review`) for terms the reviewer has time to look at.

## Inputs / outputs

| Name | Source | Required |
|---|---|---|
| `db` | `store/world/analytics.sqlite` (writeable) | yes |
| `mode` | `auto` (flip status flags) \| `report-only` (dry-run on a copy) | default `auto` |

JSON output on stdout:
```json
{
  "today": "2026-05-02",
  "mode": "auto",
  "promoted_count": 2,
  "promoted": ["TurboQuant", "Foundry-Local"],
  "retired_count": 1,
  "retired": ["OldHype-2025"],
  "pending_definitions_count": 5,
  "pending_definitions": ["TurboQuant", "Foundry-Local", ...]
}
```

`pending_definitions` is the list of `active` rows whose `quick_def` is still empty. The orchestrator hands this list to the writer's LLM context for definition generation, then calls `commit_definition()` (importable from this module) to persist each pair.

## Promotion rule

```
candidate → active   when distinct_days_14d >= 3
```

This filters single-mention noise (a term appearing once is unlikely to be load-bearing across the dashboard's reader base) while accepting any term that survives 14 days of news cycle attention.

## Retirement rule

```
active → retired   when occurrences_30d == 0
                   AND last_seen_date older than 30 days
                   AND reviewed_by_human == 0
```

Human-reviewed active rows are **never** auto-retired — the reviewer presumably curated the term deliberately and expects it to stay surfaceable even during quiet weeks.

## LLM fill prompt (writer-side template)

The orchestrator runs this against `pending_definitions` after calling `define-glossary-terms` in `auto` mode:

> For each of the following technical terms, produce:
> - `quick_def`: a single sentence, ≤ 25 words, plain language a 14-year-old would understand, no jargon.
> - `why_it_matters`: a single sentence, ≤ 25 words, explaining the real-world stake (security, cost, market structure, performance).
> - `quick_def_ja` / `quick_def_es` / `quick_def_fil`: translations of `quick_def` into Japanese / Spanish / Filipino (Tagalog). Preserve technical terms, acronyms, and named entities verbatim. If a term is so universally used in English (e.g. `MCP`, `CVE`) that a native speaker of that language would use the EN token, keep it.
> - `why_it_matters_ja` / `why_it_matters_es` / `why_it_matters_fil`: translations of `why_it_matters` using the same rules.
>
> Refuse to define a term if:
> - The token is a sentence-leading capitalized word, not a proper noun.
> - The token is already so common (`AI`, `API`) it doesn't need explaining.
> - You don't have enough context to write a meaningful sentence.
>
> Refused terms get `status='retired'` (set `reviewed_by_human=1` in the same DB call so the auto-retire rule doesn't try again next week).
>
> **Style constraints on `quick_def` and `why_it_matters` (both EN and locale variants):**
>
> 1. **No time-period markers.** Do not write specific years (`2026`, `2026-2027`), quarters (`Q3 2026`, `H2 2026`), months/dates (`May 3`, `Apr 28`, `mid-May`), or temporal hedges (`this cycle`, `今期`, `este ciclo`, `ngayong cycle`, `this quarter`, `this week`). The glossary is reused across cycles; bake the structural pattern into the wording, not the calendar. Mild present-tense markers like "currently" / 現状 / `actualmente` describing the present technical landscape are acceptable when the claim is unlikely to flip on a per-cycle basis (e.g. "currently the bottleneck for training").
> 2. **No specific dated incidents or product-release names.** Avoid `CVE-YYYY-NNNNN` numbers, named previews (e.g. `Mythos Preview`), specific gated programs (e.g. `Project Glasswing 50-org channel`), specific IPO events (e.g. `Cerebras IPO mid-May`), specific quarterly prints, and specific dollar-denominated levels (e.g. `WTI ~$105`, `AAPL $100B buyback`, `AMD OpenAI 6GW H2 2026`). Reports and predictions cover those; the glossary explains the underlying class or pattern they exemplify.
> 3. **Symmetric vendor framing.** Do not bake CVE-shaming or sensational risk language ("source of vulnerabilities", "blast radius", "killer CVE", "biggest install-base deadline") into the `quick_def` of one vendor when a structurally similar peer is described neutrally. The quick_def must describe what the term IS / DOES; CVE-class facts belong in `why_it_matters` and must be phrased symmetrically across peers (e.g. vLLM and SGLang and LiteLLM all sit in the inference-server CVE class — describe the class, not one vendor's worst incident).
> 4. **Neutral tone in `why_it_matters`.** Explain the strategic significance / stake without dramatic phrasing. Replace "leaks every credential" with "can expose multiple downstream credentials"; replace "ended the model-portability promise" with "shifts model-portability from a buyer-side promise to an operational substrate". Strategic claims are fine; editorial verdicts are not.
>
> **Test before committing:** would the wording need rewriting once the calendar advances or a new vendor enters the same class? If yes, rewrite it generically. The reports layer carries the dated facts; the glossary carries the durable definitions.

The orchestrator commits each definition via:

```python
from app.skills.define_glossary_terms import commit_definition
commit_definition(conn, term, quick_def, why_it_matters,
                  quick_def_ja=..., quick_def_es=..., quick_def_fil=...,
                  why_it_matters_ja=..., why_it_matters_es=..., why_it_matters_fil=...,
                  canonical_link=optional_link, reviewed_by_human=False)
```

**Locale contract:** all six `*_ja / *_es / *_fil` keyword arguments are optional in the Python call (nullable in the DB). Omitting them is allowed when the LLM refuses a term. But for every term that receives an EN definition, the six locale siblings **must** be produced and committed in the same call. Passing only EN and leaving locale fields NULL causes the dashboard's LANG switcher to fall back to EN silently, which is acceptable only for refused/retired terms.

`reviewed_by_human=True` is reserved for the weekly `5_weekly_theme_review` pass — the daily writer never claims human-review status, only proposes definitions.

## Reference invocation

```bash
# Daily flow (in 1_daily_update orchestrator, after extract-glossary-candidates):
python3 -m app.skills.define_glossary_terms --db store/world/analytics.sqlite --mode auto

# Sanity-check pass (no DB writes — operates on a tempfile copy):
python3 -m app.skills.define_glossary_terms --db store/world/analytics.sqlite --mode report-only
```

## Alternate fill path: YAML upsert

This skill is the **LLM-driven** fill — it produces definitions for newly-promoted candidates that don't have a hand-authored counterpart yet. There's a second, **human-driven** fill path: editing `data/reference/glossary.yml` directly and running `extract-glossary-candidates --seed-mode upsert` to propagate those edits into `glossary_terms`. Use it when:

- A weekly review identifies a translation that's wrong or a `quick_def` that drifted from the term's real meaning — fix it once in the YAML and upsert.
- A new seed term needs hand-translated locale fan-outs from day one (rather than waiting for the candidate→active→LLM-fill cycle).
- A `mismatch` verdict from `validate-glossary-terms` retired a row, the human-curated correction lives in YAML, and we want the row reinstated with the corrected definition.

The two fill paths are complementary: upsert overwrites YAML-owned fields (definitions, locale fan-out, canonical_link, status, reviewed_by_human) without touching SQLite-owned counters/dates. The field split is implemented by the seed-mode handling in `pipeline/src/ingest/glossary-extract.ts`.
