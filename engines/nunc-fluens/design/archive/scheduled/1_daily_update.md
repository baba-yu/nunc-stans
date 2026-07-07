# 1_daily_update — orchestrator

Daily flow that produces today's `report/{en,ja,es,fil}/news-YYYYMMDD.md`. Phase 3 rewrite (≤ 80 lines): all heavy LLM steps emit JSON sourcedata to `app/sourcedata/<date>/`, deterministic Jinja2 renderers turn that JSON into markdown. The LLM never writes markdown directly. Schemas + rendered shape live in `design/sourcedata-layout.md`.

## Skills called (in order)

1. **`compose-news-section`** *(LLM, sub-agent)* — search the last 3 days of trusted sources (`arxiv.org`, `simonwillison.net`, `news.ycombinator.com`, plus the topic list in `reference/news-topics.md`). Always include Unsloth in Daily-update searches; Multica only when news-driven. **Skip URLs already in `references.txt`.** Sub-agent emits `app/sourcedata/<date>/news_section.json` per `design/sourcedata-layout.md §JSON schemas (canonical) → news_section.json`. Spec: `design/skills/compose-news-section.md`.
2. **`compose-prediction` × 3** *(LLM, one sub-agent per prediction)* — produce 3 predictions. Each sub-agent emits a single entry conforming to `predictions.predictions[]` (title, body, reasoning bundle with `because`/`given`/`so_that`/`landing`/`plain_language`, summary). Parent merges them into `app/sourcedata/<date>/predictions.json`. Spec: `design/skills/compose-prediction.md`. Reasoning fields stay JSON-side; the renderer turns them into prose.
3. **`compose-headlines-pair`** *(LLM, sub-agent)* — produce paired plain + technical headlines. Sub-agent emits `app/sourcedata/<date>/headlines.json` per `headlines.json` schema. Spec: `design/skills/compose-headlines-pair.md`.
4. **`compose-change-log`** *(LLM, sub-agent)* — diff prose against the previous day. Sub-agent emits `app/sourcedata/<date>/change_log.json` per `change_log.json` schema. Spec: `design/skills/compose-change-log.md`.
5. **`extract-glossary-candidates`** — `python -m app.skills.extract_glossary_candidates --news-file <path> --db app/data/analytics.sqlite --seed-yaml reference/glossary.yml`. Idempotent. Default `--seed-mode insert`. See `design/skills/extract-glossary-candidates.md` § "Seed modes".
6. **`define-glossary-terms`** — `python -m app.skills.define_glossary_terms --db app/data/analytics.sqlite --mode auto`. LLM-fills definitions; orchestrator commits via `commit_definition()`.
   **6.5. `validate-glossary-terms`** — `python -m app.skills.validate_glossary_terms --db app/data/analytics.sqlite`. Form/dedupe checks + per-term semantic validation prompt; `mismatch` retires the row.
7. **`extract-needs` × 3** *(LLM, one sub-agent per fresh prediction)* — `python -m app.skills.extract_needs --db app/data/analytics.sqlite --prediction-id <pid> --needs-json-file app/sourcedata/<date>/needs.<pid>.json`. **Each sub writes its own per-prediction temp file under `app/sourcedata/<date>/needs.<pid>.json`** (NOT `.jtbd-tmp/` — Phase 3 stops writing there). After all 3 subs return, parent runs `python -m app.skills.extract_needs merge --date-dir app/sourcedata/<date>/` to combine into `app/sourcedata/<date>/needs.json`. Spec: `design/skills/extract-needs.md`.
8. **`citation-restriction-check`** *(deterministic, on JSON union)* — walks every `*.citations[].url` and `news_section.sections[].bullets[].citations[].url` in the just-written sourcedata; substitutes or drops on `RESTRICT` hit (explicit denylist, parent-inherited, or ToS-unconfirmed) and re-runs. Pass `--unclassified-out reference/citation-policy-review.md` so unclassified hosts upsert into the human-review ledger. Spec: `design/skills/citation-restriction-check.md`.
9. **append-references-txt** *(deterministic)* — append every cited URL in the JSON sourcedata to `references.txt`. One URL per line, idempotent.
10. **`translate-sourcedata` × 3** *(LLM, one sub-agent per non-EN locale)* — each sub-agent reads the four EN JSON files for the day + the locale-fanout contract in `design/skills/locale-fanout.md`, and writes locale-specific JSON under `app/sourcedata/locales/<date>/{ja,es,fil}/{predictions,headlines,change_log,news_section,needs}.json`. The translation contract is JSON-side only — the markdown is rendered fresh per locale by Step 11.
11. **`render-news-md` × 4** *(deterministic, inline)* — `python -m app.skills.render_news_md --date <date> --locale <L> --write` for each of `en, ja, es, fil`. Writes atomically (`tmp` + `os.replace`) to `report/<L>/news-YYYYMMDD.md` and runs `post-write-integrity --kind news` on each. Spec: `design/skills/render-news-md.md`.
12. **`ingest-sourcedata`** *(deterministic, inline)* — `python -m app.src.cli ingest-sourcedata --date <date>`. Populates `predictions` / `prediction_needs` / `needs_tasks` / `validation_rows` from JSON. Idempotent.
13. **`post-write-integrity`** *(shared, kind=news)* — already invoked inside Step 11; this is a backstop pass on all 4 written paths.
14. **`lint-markdown-clean`** *(deterministic, Phase 3 gate)* — `python -m app.skills.lint_markdown_clean --date <date>`. Greps every per-locale `news-YYYYMMDD.md` for the forbidden tokens listed in `design/sourcedata-layout.md §Naming hygiene` (`plain_language`, `JTBD`, the legacy stream-letter labels, `Pred ID #N`, `**Summary:**`, etc.). Exits 1 on any hit; abort the orchestrator. Spec: `design/skills/lint-markdown-clean.md`.
14.5. **`verify-topic-coverage`** *(LLM, sub-agent)* — dispatch a 1-sub-agent audit pass per `design/skills/verify-topic-coverage.md`. Inputs: today's `news_section.json` + `search_log.json` + `reference/news-topics.md` (which carries the §Topic scope clarifications rubric). Sub-agent reads each bullet, judges semantic coverage against the rubric, and emits `app/sourcedata/<date>/verification.json` per-topic with `semantic_verdict` (covered/uncovered/ambiguous) + `search_log_alignment` (consistent / search_log_overreports / search_log_underreports). Reply contract: `OK <path>` only, no content paste-back. This replaces the regex-based topic check with LLM-as-judge semantic verification — new vendors entering a category (e.g. a novel local-LLM ecosystem entrant the regex didn't know about) are correctly attributed via the rubric, not whitelisted by pattern.

14.6. **`check-topic-coverage`** *(deterministic, gate)* — `python -m app.skills.check_topic_coverage --date <date>`. Reads `verification.json` (preferred), falls back to `search_log.json` (legacy mode) or self-anchored identifier minimal scan (heuristic fallback). Gate logic: mandatory miss (Unsloth `uncovered` + `search_log_overreports`) → exit 1; alignment deltas (`search_log_overreports` / `search_log_underreports`) → WARN; all `consistent` → exit 0. Spec: `design/skills/check-topic-coverage.md`.
15. **`post-update-validation`** *(shared, runtime DB gate)* — `python -m app.skills.post_update_validation --check news --date $(date +%Y-%m-%d)`. Confirms today's `predictions` rows have full reasoning fields + every locale fan-out + parsed `target_*_date`, and today's `prediction_needs` + `needs_tasks` rows have full 5W1H + every locale fan-out. Exits 1 on silent NULL — abort the orchestrator. Spec: `design/skills/post-update-validation.md`.

## Writer constraints (no scope prefix — applies in every JSON field, every locale)

The forbidden-token list in `design/sourcedata-layout.md §Naming hygiene` applies to JSON sourcedata fields in addition to rendered markdown. Specifically: `(Tech)` / `(Non-Tech)` / `(Business)` / `(Mix)` / `(技術)` / `(ビジネス)` / `(Tecnología)` / `(Teknikal)` etc. must NOT appear in any title, body, summary, headline lead/body, change-log narrative, or news-section bullet body. The renderer does not strip these — it renders them through. Writer-side avoidance is the single source of truth.

Per-skill prompt regulations (JSON schema constraints + tone rules) live in `design/scheduled/1_daily_update-writer-rules.md`.

## Sub-agent dispatch (per `0_daily_master.md §Sub-agent dispatch policy`)

| Step | Dispatch shape |
|---|---|
| 1 (compose-news-section) | 1 sub-agent |
| 2 (compose-prediction)   | 3 sub-agents in parallel (one per prediction) |
| 3 (compose-headlines-pair) | 1 sub-agent |
| 4 (compose-change-log)   | 1 sub-agent |
| 7 (extract-needs)        | 3 sub-agents in parallel (one per prediction); merge inline |
| 10 (translate-sourcedata) | 3 sub-agents in parallel (one per non-EN locale) |
| 14.5 (verify-topic-coverage) | 1 sub-agent. Reply OK + path only, no content paste-back. |

Every sub-agent prompt MUST include "reply with one-line OK status, do NOT paste content back" — sub-agents return file paths, not file contents. Parent only holds path strings + DB summary counts in working memory.

## Inputs / outputs

- Reads: `references.txt`, `reference/citation-restrictions.md`, `reference/glossary.yml`, last 7 `report/en/news-*.md`, `app/data/analytics.sqlite`.
- Writes: `app/sourcedata/<date>/{predictions,headlines,change_log,news_section,needs}.json`, `app/sourcedata/locales/<date>/{ja,es,fil}/*.json`, `report/{en,ja,es,fil}/news-YYYYMMDD.md`, `references.txt` (append), `app/data/analytics.sqlite` (glossary tables + Needs tables + predictions row upsert).

## Failure modes (skill-localized)

- **compose-news-section returns < 3 articles** → re-prompt with broader date window (last 5 days).
- **compose-prediction sub-agent emits malformed JSON** → schema-validate at write time; fail-fast and re-prompt the failing sub-agent only with the schema error message.
- **citation-restriction-check exits 1** → substitute the offending URL in the JSON and re-run.
- **render-news-md fails post-write-integrity** → abort the run; the bridge is degraded (NUL-tail repair already attempted by post-write-integrity).
- **lint-markdown-clean exits 1** → a prompt regression let a forbidden token leak through. Abort; fix the writer prompt before re-running.
- **check-topic-coverage exits 1** → mandatory Unsloth was not searched / not covered (auditor verdict). Re-prompt `compose-news-section` with explicit Unsloth-search instruction; do NOT just retry. WARN (exit 0) on `search_log_overreports` / `search_log_underreports` is informational — surface in the run report so the user can spot writer self-report drift.
- **verify-topic-coverage sub-agent FAIL** → fall back to legacy `search_log.json`-only mode at Step 14.6 (still gates on mandatory). Surface the FAIL in run report; investigate before next run.

## Topic coverage check

Daily-update searches must cover, every run, the topic list in `reference/news-topics.md`. **Unsloth must be searched every run**; **Multica only when news-driven**.

## DRY_RUN

`DRY_RUN=1`: Step 11 prints planned paths and exits 0. All earlier skills run idempotently against the JSON + DB.

## Acceptance — this run is "done" when

1. `app/sourcedata/<date>/{predictions,headlines,change_log,news_section,needs}.json` all validate against their schemas.
2. `report/en/news-YYYYMMDD.md` exists, ends with newline, passes `post-write-integrity --kind news`.
3. The 3 sibling-locale files exist, each passing `post-write-integrity --kind news`.
4. `lint-markdown-clean --date <date>` exits 0 — no forbidden tokens in any locale.
5. `verify-topic-coverage` sub-agent wrote `app/sourcedata/<date>/verification.json` with all topics enumerated; `check-topic-coverage --date <date>` exits 0 — mandatory Unsloth covered, no `search_log_overreports` on mandatory.
6. `glossary_terms` table has the day's new candidates merged in.
7. `references.txt` has every newly-cited URL.
8. `post-update-validation --check news` exits 0.

The detailed schema definitions live in `design/sourcedata-layout.md`; per-skill prompt regulations (JSON shapes, tone constraints, length caps) live in `design/scheduled/1_daily_update-writer-rules.md`.
