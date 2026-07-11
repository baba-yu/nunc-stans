# App Bundle Contract

Status: v0 Draft (Phase E, 2026-07-08 — drafted at T5, after the
generator and freeze semantics were proven in code, honoring "write
contracts late")

This is the boundary between **FourFive** (the app factory — artifact
jurisdiction, §13-A) and **apps-host** (the Nunc Stans-side host that
runs what the factory made). FourFive PRODUCES bundles; apps-host
CONSUMES them; neither touches the other's internals — the directory
layout and file shapes below, plus apps-host's published API, are the
entire coupling surface. The governing idea: a bundle is **data, not
code** (plan PE2/PE3) — apps-host interprets manifests; nothing an LLM
wrote is ever executed, except the declared metric SQL under the rails
in §4.

## 1. Location and freeze semantics

```
<data store>/artifact/apps/<slug>/versions/<NNN>/
  blueprint.json      the frozen source (fourfive's format)
  bundle/             ← this contract
    app.json
    schema.sql
    mcp-tools.json
    ui.json
    tests/scenarios.json
```

- `<NNN>` is the zero-padded blueprint version. `<slug>` matches
  `^[a-z][a-z0-9-]*$`.
- **The presence of a complete `bundle/` IS the freeze marker** for
  consumers: fourfive writes it only through its freeze step (which
  stamps `frozen_at`/`bundle_hash` in its own metadata — internal),
  and a frozen version is immutable (F7; the permission table's "a cut
  version is immutable"). Regenerating a frozen version must reproduce
  the bundle byte-for-byte; any drift is refused by the producer.
- apps-host serves the **highest version that has a complete bundle**,
  discovered by filesystem scan — there is no runtime call from
  fourfive to apps-host or back.
- Bundles are deterministic functions of `blueprint.json`
  (`app.json.blueprint_hash` = sha256 of those bytes pins the lineage).
  No timestamps inside the bundle.

## 2. app.json (the manifest)

```jsonc
{
  "slug": "runway-tracker",
  "version": 1,
  "name": "Runway Tracker",
  "description": "…",             // optional
  "entities": [ /* NormalizedEntity, below */ ],
  "metrics":  [ { "name": "cash_runway", "label": "Cash runway", "sql": "SELECT …" } ],
  "stories":  [ { "id": "st-1", "title": "…", "scenario": "…" } ],
  "ui": { "screens": [ /* fourfive mock_ui screens, verbatim */ ] },
  "blueprint_hash": "<sha256 hex>"
}
```

NormalizedEntity (what the generator guarantees, what the host relies
on — the host never re-derives from the blueprint):

```jsonc
{
  "name": "deals",                 // ^[a-z][a-z0-9_]*$; not one of the
                                   // reserved names: manifest, metrics,
                                   // api, mcp, health, status, tools
  "description": "…",              // optional
  "columns": [
    { "name": "id", "type": "TEXT", "pk": true, "notNull": true },
    { "name": "name", "type": "TEXT", "notNull": true },
    { "name": "deal_id", "type": "TEXT", "fk": "deals.id" },   // in-app targets only
    { "name": "created_at", "type": "TEXT", "notNull": true, "audit": true },
    { "name": "updated_at", "type": "TEXT", "notNull": true, "audit": true },
    { "name": "archived_at", "type": "TEXT", "audit": true }
  ]
}
```

- Exactly one `pk` per entity (the generator injects `id TEXT` when the
  blueprint declares none). `type` ∈ {TEXT, INTEGER, REAL, NUMERIC,
  BLOB}.
- The three `audit: true` columns are **host-maintained**: the host
  sets `created_at`/`updated_at` on writes and `archived_at` on
  archive; clients never write them.
- `fk` appears only when the target entity/column is in the same app;
  cross-app and dependency-namespace references degrade to plain
  columns (recorded rule — no cross-app coupling in v0).

## 3. schema.sql

- `CREATE TABLE IF NOT EXISTS` per entity (idempotent application), in
  manifest order; `CREATE VIEW IF NOT EXISTS metric_<name>` per
  declared metric.
- The producer PROVES the file applies (in-memory) before the freeze;
  the consumer applies it verbatim and re-validates the metric rails
  (§4) — defense in depth.
- `schema_hash` = sha256 of this file. The host records it per app data
  dir; a mismatch between the recorded hash and the served bundle's
  means a version switch with schema drift → the app mounts
  **read-only** with an instructive error (migrations are out of scope
  in v0).

## 4. Metrics (the strategy grounding contract)

- A metric is `{name, label, sql}`; `name` matches
  `^[a-z][a-z0-9_]*$`; `sql` is **one SELECT statement** — no `;`, no
  write/DDL/PRAGMA/ATTACH verbs — over the app's own tables only.
  Both sides enforce this (generator at freeze, host before apply).
- The host executes metric views on a **read-only connection**.
- `GET …/api/metrics` (§6) is the ONLY read surface strategy features
  may quote: constitution rule — "metrics the app does not measure are
  not used as grounds." A consumer rendering strategy from metrics
  must enforce `grounding ⊆ declared names` in code.

## 5. mcp-tools.json (the declared tool surface)

```jsonc
{ "tools": [ { "name": "<slug>_<entity>_<verb>",
               "description": "…",
               "inputSchema": { /* JSON Schema, additionalProperties: false */ } } ] }
```

- Verbs: `list, get, create, update, archive` per entity. Names use
  underscores (provider tool-name charsets exclude dots — supersedes
  the v1 plan §2.8 sketch).
- The served MCP tool list is EXACTLY this file for every served app —
  declared surface = served surface, frozen with the version.
- Tool handlers execute through the same validation/write path as the
  REST API (one enforcement point): create/update schemas mirror the
  writable (non-pk, non-audit) columns, `required` = NOT NULL ones.
- Agent-side gating is the agent-abi §2 profile `skills` allowlist:
  `apps:<slug>` grants an app's five verbs; a full tool name grants
  one tool. No grant, no tool (see contracts/agent-abi.md).

## 6. apps-host published API (behind the gate at /apps/)

Host-relative (the gate strips `/apps`):

```
GET   /api                       [{slug, version, name}] — served apps
GET   /:slug/api/manifest        the served app.json
GET   /:slug/api/metrics         [{name, label, value}] (read-only conn)
GET   /:slug/api/status          {slug, version, readOnly, reason|null}
GET   /:slug/api/tools           the frozen mcp-tools.json, verbatim — the
                                 declared tool surface over REST (Phase F;
                                 the same list /mcp serves)
GET   /:slug/api/:entity         rows; archived excluded, ?archived=1 includes
POST  /:slug/api/:entity         create → the row (id host-generated if absent)
GET   /:slug/api/:entity/:id     one row
PATCH /:slug/api/:entity/:id     update writable fields → the row
POST  /:slug/api/:entity/:id/archive   soft-delete (there is NO DELETE)
GET   /:slug/                    the generic UI shell
/mcp                             MCP endpoint (Streamable HTTP)
```

- Writes are parameterized SQL against declared columns only; unknown
  fields are a 400 (deny-unknown discipline); payloads are size-capped.
- Full CRUD is allowed: app data is **working data**, never the
  ledger; the audit trail is the `updated_at`/`archived_at` columns
  (v1 plan §2.8).
- Loopback-only, plain HTTP, fronted by the gate (single origin,
  §10-B).

## 7. App user data

```
<data store>/apps/<slug>/
  data.sqlite        created lazily on first serve
  installed.jsonl    one line per install/version-switch:
                     {"slug","version","schema_hash","installed_at"}
                     — append-only, never rewritten
```

Data is local (F11), per-user, excluded from bundles. `just backup`
(D8, when it lands) must include this tree.

## 8. tests/scenarios.json

Data-driven scenario specs the host's bundle-runner executes against a
throwaway store: per-entity CRUD walks (`create → list(1) → get →
update → archive → list(0) → list(archived:1)`) with NOT-NULL fk
ancestors created first (`{"$id": "<entity>"}` tokens resolve to the
last-created row id of that entity), plus a metrics scenario asserting
every declared metric answers. Step vocabulary: `create, list, get,
update, archive, metric` with optional `expect: {count}|{ok}`.
Stories ride `app.json.stories` for traceability; compiling stories to
tests is deferred (plan, Design spec §4).

## 9. Out of scope in v0 (named)

- Schema migrations between versions (skew ⇒ read-only, §3).
- Cross-app data access and cross-app metrics.
- Executable business logic in bundles — `business_logic` stays spec
  prose inside the blueprint.
- App deletion API; transitive dependency composition (the 2026-06-09
  composition design's own deferrals stand).
- Resident/scheduled operation of agents against apps (F14 mechanical
  enforcement — SPL v3+; see contracts/agent-abi.md §5).
