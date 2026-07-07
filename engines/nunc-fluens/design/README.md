# Engine design docs

Living design documents for the nunc-fluens engine:

- `decisions/` — ADRs the pipeline's shielding/dispatch and scoring rules
  cite (ADR-001 contradiction-axis retirement, ADR-002 anti-inertia).
- `sourcedata-layout.md` — the sourcedata JSON schemas + naming-hygiene
  spec (`pipeline/src/schemas/sourcedata.ts` and the markdown lint gate
  were ported from it).

## archive/

The rest of the spec corpus imported verbatim at Phase C T0 from the
upstream news repository (`~/news`), frozen at upstream commit **9e86e01**
(2026-07-05; the oracle `app/` tree was later re-synced to `17682e9`).
These were the port's source of truth: the daily/weekly orchestrator
specs (`archive/scheduled/`) and the per-skill contracts that became
deterministic TypeScript (`archive/skills/`). The port completed at T12;
the specs are retired history — paths inside them are upstream-relative
and are left verbatim.

## Where the runtime prompts went

The 16 spec files the orchestrator reads at run time as LLM prompt
sources (12 skill contracts, the two writer-rules files,
`3_daily_briefing.md`, `memory-policy.md`) — plus
`locale-fanout-calques.md`, which locale-fanout mandates — moved to
`pipeline/prompts/` (post-C refactoring, 2026-07-06). They are loaded by
`pipeline/src/orchestrator/core.ts` (`promptsDir()`), and they are
**normally-editable behavior files** now: the "verbatim frozen" rule
expired when oracle-parity verification closed at T12. Editing them
changes live prompts (never replay), and `pipeline/test/prompts-resolution.test.ts`
guards that every runtime load still resolves.
