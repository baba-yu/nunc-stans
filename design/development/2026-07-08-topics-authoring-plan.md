# Plan — Topics authoring: configurable research targets with intent weights

**Status: APPROVED — decisions W1–W11 and the plan handed off for
execution by the owner in session, 2026-07-08 (the §7 two-step; the
owner authored this plan and delegated execution — "Topics入力のUXとUIも
検討したからそれもお願い"). Branch `topics-authoring` off `dev`; W4/W6/
W11's llama-cpp dependencies (T4+) wait for `phase/e` to land on dev.**

**Goal:** Give the human a first-class way to author what the news/
investigation pipeline searches for — not a hand-edited markdown list and
a hardcoded gate array that silently drift, but ONE structured source the
user writes in natural language, the system structures into JSON, and the
user hand-edits. Each topic carries an **intent** that mechanically sets
how much search is spent on it. This is the first concrete step of the
nunc-fluens VISION (2026-07-06): research targets become **configurable/
dynamic**, not a standing routine — the substrate that grounds fourfive
sessions and strategy-making.

Authoring is **ongoing, not init-only**: the user asks in natural language
to add or refine topics at any time ("track newborn agent-harness ideas
broadly"), and the request is structured and merged into the existing set
(with review). As the **World grows, the assistant grounds suggestions in
the corpus offline** — the instance's glossary, existing topic names, and
export vocabulary become the structuring context, so no web call is needed
and terms align with what the world already knows. Because authoring runs
on **nunc-ai structured output against a local model, a running local LLM
(`llama-server`) is a hard runtime dependency** of this feature.

**Background (verified 2026-07-08):** topics have TWO sources of truth
today, and they can drift:
- `<instance>/data/reference/news-topics.md` — a plain markdown bullet
  list, read at run time by compose-news-section
  (`engines/nunc-fluens/pipeline/src/orchestrator/steps.ts:159,204`) and
  fanned out one search query per topic.
- `ALL_TOPICS` + `MANDATORY` + `NEWS_DRIVEN` — **hardcoded arrays** in
  `engines/nunc-fluens/pipeline/src/gates/check-topic-coverage.ts:14-34`,
  which is what the coverage gate actually enforces.
Editing the `.md` does not change the gate; there is no UI for either.
Constitution F6 / editorial-policy: topics are user-authored; the AI must
never silently modify them (`design/constitution/constitution.md:109`).

---

## Design decisions (proposed — ratify before code, per §7)

| # | Decision | Choice |
|---|----------|--------|
| W1 | Single source of truth | `<instance>/data/reference/news-topics.json` becomes the ONLY topic authority. The hardcoded `ALL_TOPICS`/`MANDATORY`/`NEWS_DRIVEN` in check-topic-coverage.ts are **removed** and derived from it; compose reads it too. One-time `.md` → `.json` migration (below). |
| W2 | Topic model | `{ name: string, intent: "deep"｜"broad"｜"watch", mandatory: boolean, note?: string }`. `intent` = the search-weight axis; `mandatory` is **orthogonal** (must be enumerated every run regardless of intent — preserves today's Unsloth MANDATORY). `note` carries the user's natural-language trace. |
| W3 | Intent → search (hybrid agentic / deterministic) | **No fixed cap.** `watch` = one query; `broad` = a light multi-angle pass; **`deep` = a goal-driven search *skill*** (agentic loop toward coverage). The agent DECIDES (next queries, is-the-goal-met) but the **search itself is deterministic** (owner directive 2026-07-08): the model emits a **structured query-plan + coverage judgment** (LLM artifacts), and the orchestrator executes each query through the adapter as code — dedup, convergence stop (no new domains/results), formatting — then loops. **Reproducibility:** the agent's LLM decisions are **captured as artifacts and replayed** — live is agentic, replay/goldens are deterministic (the pipeline's existing capture/replay discipline), so CI never depends on model variance. Structured-output plan/judge is the v1 mechanism (more reliable on local models than tool-calling); native `tool_use` (model calls the search tool directly) is the evolution once local tool-calling is proven (T4/PE9). All topics searched every run (stateless). |
| W4 | Authoring UX | Natural-language in → **nunc-ai structured output** (jsonSchema = the topic model) proposes the JSON → rendered as an editable form → user hand-edits → save. The **fourfive blueprint-extractor pattern** (`engines/fourfive/server/llm/blueprint-prompt.ts` + zod), reused. |
| W5 | F6 reconciliation | The AI **assists structuring**; nothing is written until the **user reviews and approves** the form. This is "AI proposes → human confirms," not silent modification — F6 intent preserved. The extractor never runs unattended. |
| W6 | Gate endpoint | New `gate/src/topics.rs`: `GET/PUT /api/world/topics` ↔ the linked instance's `news-topics.json`. Atomic write, deny-unknown fields (the news_config.rs pattern). Optional `POST /api/world/topics/extract` proxies the NL→JSON call, or the front end calls nunc-ai directly — decided at T4 on the fourfive precedent. |
| W7 | Write target + read-only guard | Edits target the **linked instance** (`newsRepo`). PUT is **refused (409, read-only)** when the source is not a writable init-born instance — never write a view source, never write `~/news` (fork rule). See the view-vs-run note below. |
| W8 | Shared loader | New `engines/nunc-fluens/pipeline/src/topics.ts`: parse + validate `news-topics.json` → `Topic[]`. Single consumer for compose (names + weights), the coverage gate (names + mandatory), and extractor-output validation. `SELF_ANCHORED` regex fallbacks stay, keyed by name. |
| W9 | Ongoing NL authoring | Not init-only. The editor accepts a natural-language request at any time and **merges** the structured result into the existing `topics[]` (add new, refine existing by name), never blind-overwrites. Full-list edit and incremental "add a topic about X" are the same extract→review→save path; the merge is diff-shown before the user approves. |
| W10 | World-grounded offline vocabulary, fed by cron | The authoring extractor grounds **offline** on the linked instance's **glossary** (`data/reference/glossary.yml`) + existing topic names — a light, single context. The glossary is kept rich by a **scheduled step that accumulates export-graph vocabulary into it** (owner idea 2026-07-08): the World's growth feeds the glossary in the background, not the authoring prompt, so authoring stays cheap and the glossary is the one enriched vocabulary source. Reuses the existing glossary machinery (glossary-extract / define / validate). |
| W11 | Local LLM is a managed runtime dep, model auto-provisioned | Authoring needs a running `llama-server` (PE9'). `just up` gains a **`_up-llama`** sub-recipe that **ensures a model then launches** — if none is installed it auto-provisions the default small CPU GGUF (no silent skip; skipping breaks authoring, owner directive 2026-07-08). First `up` therefore may download the model once (GBs) — **surfaced, not silent**. `just setup` chooses/upgrades the model; `just llama` runs it standalone. The front end still degrades honestly ("local model offline") if the server is unreachable. |

**View-source vs run-target nuance (W7):** `news-link` designates a
*read-only view source* (justfile: "data/exports/ only"); a run targets an
instance via `NS_INSTANCE`. For the ordinary product user these are the
**same writable instance** (you link and run your own). For the owner's
`~/news` fork they differ and the source is read-only. So: the topic editor
edits the linked instance's `news-topics.json` **iff it is writable**
(init-born, has `instance.json`, not a bare news-shaped checkout); otherwise
the editor is read-only with an explains-why banner. No new "active
instance" pointer in v1 — revisit if the two roles need to split.

**`.md` → `.json` migration:** `news-init`/`import` write `news-topics.json`
from the template; a `news-topics.md` with no `.json` beside it is converted
on first read (bullets → `{name, intent:"broad", mandatory:false}`), written
back once. The template + the 3 existing instances (data/coldstart/news) +
synthesize.ts goldens are updated in-repo. `NEWS_DRIVEN`'s current meaning
is audited at T1 and either mapped to an intent or consciously retired
(recorded).

---

## Tasks (dependency-ordered; T1–T3 nf and T4 runtime run in parallel)

- **T0 — plan commit + baselines.** Ratify → commit this plan; re-measure
  pipeline/gate/fe suites; audit `NEWS_DRIVEN` semantics; tag.
- **T1 — schema + loader (nf).** `topics.ts` (model, parse, validate,
  `.md`→`.json` converter); template + 3 instances + goldens migrated;
  unit tests (parse, migrate, mandatory/intent extraction).
- **T2 — coverage gate reads the loader (nf).** Remove hardcoded arrays;
  derive `ALL_TOPICS`/`MANDATORY` from `topics.ts`; existing coverage
  tests green against the migrated fixtures.
- **T3 — intent → search skill (nf).** Implement the W3 hybrid: `watch` = 1
  query; `broad` = light multi-angle; **`deep` = a goal-driven search skill**
  (structured query-plan + coverage-judge loop; deterministic adapter
  execution with dedup + convergence stop). The loop's LLM decisions are
  captured as artifacts (replay-deterministic); a new
  `prompts/skills/deep-search.md` skill + orchestrator wiring; goldens
  regenerated + audited; determinism proven by a replay double-run.
- **T3b — glossary vocabulary accumulation (nf).** A scheduled step distills
  export-graph vocabulary into the instance glossary (W10) — offline, reusing
  glossary-extract; wired into the daily/weekly chain or a standalone recipe;
  goldens updated. Feeds T6's grounding so authoring reads only the glossary.
- **T4 — local LLM runtime (tool/fe).** `_up-llama` in `just up` **ensures a
  model** (auto-provisions the default CPU GGUF if none, surfaced) then
  launches `llama-server`; standalone `just llama`; `just setup`
  chooses/upgrades the model. **Closes the deferred #5 live check**: run the
  real `llama-server` and confirm the `llama-cpp` provider against actual
  frames (chat, stream, `reasoning_content`, `response_format` json_schema,
  `tool_calls`). Prereq for T6/T7.
- **T5 — gate topics API (gate).** `topics.rs` GET/PUT (+ optional extract
  proxy), atomic, deny-unknown, read-only 409 guard; gate tests incl. the
  read-only path.
- **T6 — Formans TopicEditor (fe).** WorldView panel: NL box → structured
  proposal grounded in the instance's glossary + existing names (offline)
  → **diff-merge review** (add/refine, never blind-overwrite) → save;
  ongoing "add a topic about X" at any time; honest "local model offline"
  degrade when `llama-server` is unreachable; api.ts GET/PUT; vue-tsc +
  logic tests.
- **T7 — story + verification.** Author in NL → structure (world-grounded,
  offline) → merge-review → save → a run honors the weights, with a
  mechanical verdict and the local-LLM-required + offline-grounding legs
  shown; evidence in `design/verification/`.

## Exit criteria

1. `news-topics.json` is the only topic authority; the coverage gate and
   compose both read it via `topics.ts`; the hardcoded arrays are gone.
2. A topic authored in natural language is structured to JSON, hand-edited,
   saved to a writable instance, and refused (read-only) on a view source.
3. An **ongoing** NL request ("add a topic about X") **merges** into the
   existing set (diff-reviewed), not a blind overwrite.
4. Suggestions are **grounded offline** in the instance's glossary +
   existing topic names; no web call in the authoring path.
5. `intent` demonstrably changes search fan-out query counts; goldens
   regenerated deterministically; suites green.
6. `just up` starts `llama-server`; authoring works against it and
   **degrades honestly** when it is not running; the `llama-cpp` provider
   is confirmed against real llama.cpp frames (closes #5).
7. F6 holds: no unattended AI write; user approves every save.
8. Story executed with evidence; `just check` green; 3-OS CI green.

## Non-goals (named)

- **Cadence/scheduling of `watch` topics** (skip-some-runs) — v1 is
  stateless query-weighting; last-searched bookkeeping is future work.
- **Per-topic source/adapter routing** (which search engine per topic).
- **Auto-generated topics** — the AI never invents topics unattended;
  world-grounded suggestions are proposals the user approves (F6, W5).
- **Cloud/web fallback for authoring** — offline by design (local model +
  local vocabulary); no remote LLM or web-search in the authoring path.
- **Cross-instance topic sharing / topic history UI.**
- **Numeric free-form weights** — v1 is the three-intent enum, not a slider.

## Risks

1. **Goldens churn (T3):** changing fan-out counts moves synthetic
   outputs. Mitigate: regenerate via synthesize.ts, audit the diff, one
   manual double-run for determinism (the Phase C goldens discipline).
2. **NL→JSON quality:** the extractor may mis-structure. Mitigate: the
   user always edits before save (W5); schema-validate the proposal;
   scripted `mock` keeps CI deterministic (mock-degradation §2.10).
3. **View/run instance ambiguity (W7):** the read-only guard must be
   unambiguous so no one edits a view source. Mitigate: writability probe
   (instance.json + write test) + explicit banner.
4. **Concurrency with Phase E:** this is nf-centric and independent of
   apps-host; run on its own branch off dev to keep phases clean.
5. **Local LLM must be running (W11):** authoring is dead without
   `llama-server`. Mitigate: `_up-llama` starts it with `just up`, `just
   setup` installs+validates it, and the UI degrades honestly (never
   silently). CPU model is enough for structuring (small prompts).
6. **Merge duplicates/conflicts (W9):** an "add" that names an existing
   topic must refine, not duplicate. Mitigate: name-normalized merge +
   the diff-review step before save; the user is the tiebreak.
7. **Offline-grounding quality (W10):** a thin/young World gives little
   vocabulary. Mitigate: grounding is additive context, never a hard
   dependency — a fresh instance still authors from the raw NL.
8. **Uncapped deep search cost/convergence (W3):** "no cap" must still
   terminate. Mitigate: deterministic convergence stop (no new
   domains/results ends the loop) + a soft budget/rate-limit guard; the
   agent judges coverage but the stop is enforced in code, not left to
   the model. Watch the 1.1s/query rate-limit sleep on wide deep loops.

## Verification plan (`design/verification/<this>.md` must contain)

Baselines; the migration proof (`.md`→`.json` byte/structure check); the
coverage-gate-reads-loader proof; the fan-out determinism record (goldens
double-run); the read-only-guard 409 output; the F6 record (no unattended
write); the executed story transcript with a numbered verdict; CI link.
