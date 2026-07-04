# nuncstans-engine

v0 — the source-of-truth engine for the self scope: commitments, edges, and
outcomes, file-backed. Manages what the constitution assigns to NuncStans
(edges §10-A, mandates F14); the mandate machinery itself arrives with SPL v3.

The source-of-truth data lives **outside this repository** (F11) and is only
ever passed in explicitly via `--self-dir` — its location never appears in
this repo (FD-3.2). The engine binds loopback only, serves the ME view
same-origin, offers no CORS at all, and refuses requests whose Host header
is not localhost (DNS-rebinding guard).

## Run

From the federation root, with `FED_DATA` exported in your shell:

```sh
just up
```

or directly:

```sh
cargo run -- --self-dir <path-to-self-vault> --static-dir ../../frontend --port 8720
```

## API (v0)

| Route | Meaning |
|---|---|
| `GET /health` | liveness |
| `GET /self/commitments` | list commitments (malformed files skipped and counted) |
| `POST /self/commitments` | author a commitment — `{slug, title, started_at, resources{money_jpy, hours}, note}`; refuses an existing slug (append-only; supersede, don't edit) |
| `GET /self/edges` | list edges (malformed lines skipped and counted) |
| `POST /self/edges` | append an edge — validated against `contracts/edge.schema.json` (type enum, federation-id patterns, `to_label` required); id and `created_at` are assigned by the engine |
| `POST /self/outcomes` | record one close component — `{commitment_slug, component: observable\|subjective, result, note}`; subjective vocabulary is closed (`happy/unhappy/unchanged/refused_to_judge`), observable is extensible (prd-override §1.1) |
| `GET /self/outcomes/{slug}` | list a commitment's recorded outcomes |

Every successful write is followed by a best-effort commit into the vault's
own git history — the interim audit record (prd-override §1.2). The response
reports `vault_committed`.

## What v0 deliberately does not do

- No mandate enforcement yet — kept generic for resident-program checks later
  (prd-override §1.3); arrives with the v3 DB.
- `author` on an edge is caller-supplied; server-side peer derivation (Inv 5)
  arrives with the v3 DB.
- Append-only is enforced at the API layer only (no PUT/DELETE exists, files
  are `create_new`, the jsonl is append-mode only); DB triggers arrive in v3.

## Development

```sh
cargo build && cargo test && bash scripts/smoke.sh
```
