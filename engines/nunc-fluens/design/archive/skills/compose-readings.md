# Skill: compose-readings

LLM sub-agent that emits **chain edges + relations + cluster pointers for one prediction**, suitable for merge into the day's `app/sourcedata/<date>/readings.json`. Called from the super-backfill v2 chronological walker — one sub-agent per prediction, parallel within a day.

## Sub-agent context (parent supplies)

- The prediction's full record: `id`, `title`, `body`, `reasoning` 5-tuple.
- The prior 7 days of complete predictions (`prior_predictions` from `super_backfill.prepare_context`) — chain-edge candidates.
- This day's already-resolved bridges (`app/sourcedata/<date>/bridges.json`) — provides evidence ids that may mediate chain edges.
- This day's evidence-cluster index excerpt: a list of cluster keys (`theme.<theme>_<YYYY-Www>` shape) for evidence linked to this prediction.
- The full canonical schema for `readings.json` (`ReadingsFile` in `app/skills/sourcedata_schemas.py`).
- Target output path: `app/sourcedata/<date>/readings.<pid>.json`.

## Required output

A single JSON object scoped to this prediction (NOT the full day's `readings.json`):

```json
{
  "prediction_id": "prediction.<sha>",
  "chain_edges": [
    {
      "source_prediction_id": "<this prediction or a prior>",
      "downstream_prediction_id": "<the other end>",
      "via_evidence_id": "evidence.<sha> | null",
      "strength": 0.0-1.0,
      "notes": "≤ 25 words; why this edge holds"
    }
  ],
  "relations": [
    {
      "prediction_a": "prediction.<sha>",
      "prediction_b": "prediction.<sha>",
      "relation_type": "parallel | exclusive_variant | negation | entails | equivalent",
      "family_id": "family.<slug> | null",
      "prob_mass": 0.0-1.0 | null,
      "notes": "≤ 25 words"
    }
  ],
  "cluster_pointers": [
    {"prediction_id": "<this prediction>", "cluster_keys": ["theme.<id>|<YYYY-Www>", ...]}
  ]
}
```

## Reasoning rules + refuse to fabricate

- **Chain edges**: evidence-mediated entailment OR direct semantic implication only. If `entails(A, B)` applies, prefer the `relations` entry (schema.sql 1015-1018).
- **Relations**: `equivalent` paraphrase, `entails` narrower-implies-broader, `negation` strict complement, `exclusive_variant` competing scenarios in one outcome space (group via `family_id`), `parallel` default for independent facets.
- **Cluster pointers**: copy keys for evidence rows already linked to this prediction in `prediction_evidence_links`. Do NOT invent new clusters.
- Empty arrays are valid output. Inventing edges or relations to fill quotas breaks water-mass detection.

## Dispatch + parent post-processing

One sub-agent per prediction in the day's `predictions_to_compose`; parallel within a day. Parent validates each per-prediction file (subset of `ReadingsFile`), then runs `merge_readings_files(date_dir)` after all sub-agents finish. The merge dedupes edges on `(source, downstream, via_evidence_id)` and relations on the unordered `(a, b)` + `relation_type`, last-write-wins. Output: `app/sourcedata/<date>/readings.json`.

## Reply contract

`OK <path>` or `FAIL <reason>`. Never paste the JSON body back to the parent context.
