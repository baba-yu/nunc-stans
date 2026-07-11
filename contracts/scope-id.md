# scope ID Contract

A scope ID is composed of three elements: scope/type/original-id.

```text
<scope>/<type>/<original-id>
```

## Scope

- `world`: world prediction, observation, and external context owned by News
- `self`: self-prediction, commitment, outcome, revision, mandate, superposition_state, and edge owned by Nunc Stans; user-authored world predictions are stored in self with scope=world
- `artifact`: fixed artifact version owned by FourFive

## Rules

1. Use each system's original ID as-is.
2. The integration side does not rename IDs.
3. A scope ID is a prefix applied at the boundary, not a replacement of each engine's internal ID.
4. Retroactive registration of past records may use a free-form slug, but it must be stable.
5. If ID resolution fails, display the edge's `to_label`.

## Examples

```text
world/prediction/prediction.3f9a
self/commitment/2025-08-gpu-server
self/superposition_state/9b1c…
artifact/artifact_version/runway-tracker@v1
```
