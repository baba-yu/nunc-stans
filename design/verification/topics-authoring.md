# Topics-authoring verification record

- Start: 2026-07-08. Branch `topics-authoring` off `dev` at **fd7d5d4**
  (tag `pre-topics-authoring`) — the plan's own risk-4 rule (nf-centric,
  independent of Phase E's apps-host; run on its own branch). W4/W6/W11's
  llama-cpp dependencies (T4+) wait for `phase/e` to land on dev.
- Plan: `design/development/2026-07-08-topics-authoring-plan.md` —
  W1–W11 + plan approved by the owner in session 2026-07-08 (owner-
  authored, execution delegated).
- Constraints carried: never write a view source / production `~/news`
  (fork rule, W7); scratch dirs for every test; F6 — the AI never
  modifies topics unattended.

## T0 — Preflight (2026-07-08)

- Baselines on the dev base (measured this morning on the identical
  tree): pipeline 193, gate 6+12, ns 11, nunc-ai 35, Formans 20,
  fourfive 24, agent 22; check.ts ok.
- **NEWS_DRIVEN audit (plan migration note):** the set at old
  `check-topic-coverage.ts:34` affected DISPLAY ONLY — a `[news-driven]`
  finding tag, no enforcement anywhere. Resolution: the annotation now
  rides the DATA — the topic's `note` field renders as the tag
  (`tagOf`), and the template carries `note: "news-driven"` on the
  Multica topic, so gate output stays byte-compatible while the
  hardcode dies. `mandatory` (Unsloth) is enforcement and maps to the
  model field.

## T1 + T2 — single authority, derived consumers (2026-07-08, 2567ae9 nf)

One nf commit (the two tasks share the compile unit; the plan's T-split
was sequencing guidance, recorded here). NB: the template
`news-topics.md` deletion rode the preceding design commit (d896efa) —
single-area rule held (design/ is free), noted for honesty.

- `src/topics.ts`: `Topic {name, intent deep|broad|watch, mandatory,
  note?}` + file shape `{topics[], reference_sites?}` (the md's
  "Default reference sites" section survives the migration —
  a T1 derived decision; compose inlines them as before); strict
  parser (refuses rather than half-loads an editorial-policy file,
  duplicate names refused); `.md`→`.json` converter (names VERBATIM —
  the gate, verification.json entries, and the goldens all match
  exactly; `mandatory` derives from the human's own "every run"
  annotation); `loadTopics` = json authority > lazy md conversion with
  best-effort write-back (read-only sources convert in memory) >
  instructive refusal; `topicsPromptBlock` keeps the md-era prompt
  shape.
- `check-topic-coverage.ts`: `ALL_TOPICS`/`MANDATORY`/`NEWS_DRIVEN`
  hardcodes REMOVED; the gate takes `topics: Topic[]`; SELF_ANCHORED
  regex fallbacks stay keyed by name (W8).
- `steps.ts`: compose fan-out + writer prompt + the verify-topic-
  coverage verbatim-enumeration rail + the gate call all read the
  instance's topics via the loader ("always include Unsloth" prompt
  wording generalized to "every mandatory topic" — data-driven now).
- `instance.ts` TEMPLATE_REQUIRED: md → json. `import.ts`: an imported
  news-shaped source's real `news-topics.md` is converted OVER the
  template seed json (the authority reflects the import, not the
  template) — regression-tested.
- Template: `news-topics.json` seed (16 verbatim topics, Unsloth
  `mandatory:true`, Multica `note:"news-driven"`, example.com site);
  `news-topics.md` retired.
- Goldens: regenerated via synthesize.ts (`GATE_TOPICS` now reads the
  template json; the fixture input instance carries json, md gone).
  **Diff audited: volatile build stamps (`build_id`/`generated_at`)
  plus the topics-file swap — no substantive output change**, which is
  the expected result of a name-preserving migration.
- Tests: pipeline 193→**201** green (8 new: parse rails, verbatim
  conversion + mandatory derivation, json-over-md priority, lazy
  write-back, instructive refusal, prompt-block shape) + the import
  conversion assertions; typecheck green; `node tools/check.ts` ok.

## Exit criteria progress

1. [x] `news-topics.json` is the only topic authority; gate + compose
       read it via `topics.ts`; hardcoded arrays gone. [T1+T2]
2. [ ] NL authoring → structure → hand-edit → save; read-only refusal
       on a view source. [T5+T6]
3. [ ] Ongoing NL merge (diff-reviewed). [T6]
4. [ ] Offline world-grounded suggestions. [T3b+T6]
5. [ ] `intent` changes fan-out counts; goldens deterministic. [T3]
6. [ ] `just up` runs `llama-server`; provider confirmed vs real
       frames; honest degrade. [T4]
7. [x] F6 holds so far: nothing writes topics unattended (the lazy
       converter only rewrites what the md already said — a format
       migration, not a content edit; recorded reading of W5).
8. [ ] Story executed with evidence; CI green. [T7]
