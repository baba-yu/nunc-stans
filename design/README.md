# design/ — the Nunc Stans design corpus

The design tree of the Nunc Stans monorepo: product definition,
constitution, architecture contracts, operative plans, acceptance stories,
and verification records. (Until 2026-07 this corpus lived in a separate
design repo; it was absorbed here with history in Phase A.)

Start here:

```text
design/documentation-reading-order.md
```

The two documents that are almost always the right entry point:

```text
design/development/2026-07-04-nuncstans-v1-plan.md   ← the operative plan (Phases A–F, decisions D1–D10)
design/naming.md                                     ← the naming map; read it before any pre-2026-07 document
```

Ground rules for this tree:

- Plans live in `design/development/`, one file per plan, dated.
- Acceptance stories live in `design/stories/`; a phase closes only when its
  stories ran, with evidence in `design/verification/<phase>.md`.
- Historical documents are never rewritten to pretend the present; the
  naming map and git history carry the translation.
