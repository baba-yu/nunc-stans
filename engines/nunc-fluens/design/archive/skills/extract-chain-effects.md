# Skill: extract-chain-effects

For a fresh prediction (or as a backfill pass), identify which other predictions in the system would be **strengthened** if this one lands. Persists rows in `prediction_chain`.

## Why this is its own skill

Chain detection is **LLM-only** work that needs the full prediction body + reasoning trace + context of other predictions. Inlining it inside `1_daily_update` would re-pay the cost on every retry of any other failing step.

## Chain vs. entails — the canonical rule

`prediction_chain` and `prediction_relations.entails` look similar but mean different things. **They must not coexist on the same (source, downstream) pair.**

| | `prediction_chain` | `prediction_relations.entails` |
|---|---|---|
| Meaning | Evidence-mediated, partial strengthening | Strict logical implication |
| Strength | 0.0 – 1.0 (probabilistic) | Implicit 1.0 (no field) |
| Mediation | Often via a specific `via_evidence_id` | Direct, no evidence needed |
| Example | "If A lands, the post-mortem A produces feeds OWASP Top-10 vocabulary, which strengthens B" | "If A lands ('≥2 carve-outs publish'), B follows by definition ('≥1 carve-out publishes')" |

**Rule for the writer:** if `entails(A, B)` exists in `prediction_relations`, **do not** also add `chain(A, B)` to `prediction_chain`. `entails` is strictly stronger and renders chain redundant. The export pipeline guards against the inverse case (treats `entails` as the canonical signal when both exist), but writer-side avoidance is the source of truth.

When in doubt: if the downstream prediction's claim follows by **definition** from the source's claim, use `entails`. Otherwise (mediated by evidence, partial, or weakened), use `chain`.

## Inputs

| Name | Source | Required |
|---|---|---|
| `db` | `app/data/analytics.sqlite` | yes |
| `source-prediction-id` | the just-ingested prediction's ID | yes |
| `candidate-prediction-ids` | predictions to evaluate as potential downstream targets (typically the last 14 days) | yes |

## Outputs

- 0+ rows in `prediction_chain` (one per detected chain pair).
- JSON summary on stdout: `{"source_prediction_id": "...", "chain_count": N, "skipped_due_to_entails": M}`.

## LLM prompt template (writer-side)

> Given a source prediction P_a (just made) and a list of candidate downstream predictions, identify which downstream predictions would be **strengthened** if P_a lands. For each detected chain:
>
> 1. `downstream_prediction_id` — the candidate.
> 2. `via_evidence_id` — the specific evidence item that mediates the chain (the new fact P_a's landing creates), or `null` if the strengthening is general / multi-faceted.
> 3. `strength` — confidence in [0, 1]. 0.5 = plausible mediation; 0.9 = strong.
> 4. `notes` — ≤ 25 words explaining the mediation path.
>
> **Skip a candidate if** the downstream prediction is logically **entailed** by P_a (a strict implication). Those belong in `prediction_relations` as `entails`, not in `prediction_chain`.
>
> Refuse to fabricate. If unsure, omit the candidate.
>
> Output a JSON list of `{downstream_prediction_id, via_evidence_id, strength, notes}` objects.

## Reference invocation

```bash
python3 -m app.skills.extract_chain_effects \
  --db app/data/analytics.sqlite \
  --source-prediction-id <pid> \
  --candidates-json-file /tmp/candidates.json \
  --chain-json-file /tmp/chain.json
```

`--chain-json-file` is the LLM's JSON list. The Python wrapper validates the shape, deduplicates against existing `prediction_relations.entails` rows, and writes the rows.

Implementation: TBD (`app/skills/extract_chain_effects.py`). The schema (`prediction_chain` table) is in place; the skill wraps INSERT logic + the entails-dedupe guard.
