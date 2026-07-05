# ADR-001 — Contradiction axis retirement

**Status:** Accepted (2026 scoring redesign, exact date pre-`3a86375` Phase 1 app/ tracking; ratified retroactively 2026-05-11)
**Authors:** Yuki + redesign work
**Supersedes:** `design/PRD.md §4.3` (Contradiction score), `design/PRD.md §6.4` portions that emit `status='contradicted'` / `status='mixed'`

## Context

The original PRD modeled prediction validation along **two axes**:

- `realization_score` — evidence supporting the prediction's stated outcome
- `contradiction_score` — evidence against the prediction's stated outcome

The contradiction axis fed:

- `prediction_evidence_links.support_direction` IN (`support`, `contradict`, `neutral`)
- `prediction_evidence_links.contradiction_score` (float)
- `theme_status` enum: `contradicted`, `mixed`
- `prediction_scope_assignments.latest_contradiction_score`

Phase 4 designed the writer flow to emit `support_direction='contradict'` items when today's news contradicted a standing prediction; `compose-bridge` had a `support_direction` field on the per-row bridge object.

## Empirical observation (pre-redesign)

Across the Phase 4 corpus (and confirmed retrospectively against the 1607 evidence rows in `app/data/analytics.sqlite` as of 2026-05-11):

- **`support_direction='contradict'`: 0 rows in all of project history.**
- **`contradiction_score > 0`: 0 rows. `MAX(contradiction_score) = 0.0`.**

Writers never produced contradict signals in practice. Two contributing factors: