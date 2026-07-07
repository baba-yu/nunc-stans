# Imported spec corpus (Phase C port source)

Verbatim copies from the upstream news repository (`~/news`, becoming the
`nunc-fluens` data+publish remnant at Phase C), frozen at upstream commit
**9e86e01** (2026-07-05, subtree diff against `app/` verified clean the same
day). Imported per the Phase C plan
(`design/development/2026-07-05-phase-c-plan.md`, T0).

These documents are the **source of truth for the TypeScript port**: the
daily/weekly DAG (`scheduled/`), the per-skill prompt and check contracts
(`skills/`), the sourcedata JSON schemas (`sourcedata-layout.md`), and the
ADRs the orchestrator's shielding/dispatch rules cite.

Rules:

- Do not edit these copies to change pipeline behavior — behavior lives in
  `pipeline/` (code + prompt assets). Fixes discovered during the port are
  made in the port and recorded; these files stay as imported.
- Paths inside the documents still say `app/...`, `design/...`,
  `report/...` etc. relative to the upstream repo layout — read them as
  upstream-relative. The pipeline resolves the live equivalents via its
  `newsRepo` config.
- After the Phase C cutover the upstream `design/scheduled/*.md` prompts are
  retired as executable things; this frozen copy remains the historical
  contract the port was verified against.
