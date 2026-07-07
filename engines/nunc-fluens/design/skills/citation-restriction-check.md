# Skill: citation-restriction-check

Block citations to denylisted hosts. Shared by `1_daily_update` (post-EN-draft, pre-references-append) and `2_future_prediction` (pre-locale-fanout).

## Why this is its own skill

Both daily flows need the same denylist gate. Inlining it twice in the orchestrator markdown leads to drift (e.g. `1_daily_update` blocks `cnbc.com` but `2_future_prediction` forgets and ships a violation through the locale fan-out, multiplying the breach 4×). One skill, one source of truth: `reference/citation-restrictions.md`.

## Inputs / outputs

| Name | Source | Required |
|---|---|---|
| `draft` | path to the EN draft markdown | yes |
| `policy-file` | `reference/citation-restrictions.md` (default-allow when missing) | optional |
| `unclassified-out` | `reference/citation-policy-review.md` ledger to upsert UNCLASSIFIED sightings into | optional |

Stdout report:
- `OK reference restriction: <draft>` — no blocking hits.
- `FAIL reference restriction (denylist):` — explicit `denylist` hit. **Exit 1.**
- `FAIL reference restriction (parent-inherited):` — host is a member (or subdomain of a member) of a `parent_groups` entry whose corporate ToS bans AI/scraping. **Exit 1.**
- `FAIL reference restriction (ToS unconfirmed → safe-side):` — host is in `unconfirmed_denylist` (ToS unreachable at last survey, defaults to NG). **Exit 1.**
- `CAUTION (paywalled, paraphrase only): host url` — informational, exit 0.
- `NOTE (attribution required, format already enforces): host` — informational, exit 0.
- `UNCLASSIFIED hosts seen in this draft: …` — informational. When `--unclassified-out` is set, each sighting is upserted into the ledger with `count`, `first_seen`, `last_seen`, `sample_label`.

## Behavior

1. Parse `policy-file` into five buckets: `denylist`, `parent_groups` (list of {parent, members[]}), `unconfirmed_denylist`, `paywall_short_quote_only`, `requires_attribution`.
2. Walk every markdown link `[text](url)` in `draft`.
3. Map each URL's host (lowercase, strip `www.`) through `classify_host`. Resolution order:
   - explicit `denylist` → hard-fail
   - `parent_groups` (suffix match on dot boundary: `foo.cnbc.com` matches member `cnbc.com`; `notcnbc.com` does not) → hard-fail
   - `unconfirmed_denylist` → hard-fail (safe-side)
   - `paywall_short_quote_only` → caution (paraphrase only)
   - `requires_attribution` → note
   - otherwise → unclassified (default-allow)
4. On any hard-fail → emit FAIL lines and exit 1. The orchestrator must substitute or drop and re-run.
5. When `--unclassified-out PATH` is provided, upsert UNCLASSIFIED sightings into a markdown ledger at PATH. Counts accumulate across runs; `first_seen` is preserved, `last_seen` bumps to the draft's date. The ledger is sorted by `count` descending, then host alphabetical.

When the policy file does not exist, emit `TODO: <path> missing — restriction check skipped` and exit 0. Don't block the run.

## Policy file shape (`reference/citation-restrictions.md`)

Single H2 sections, parsed in order: `denylist`, `parent_groups`, `unconfirmed_denylist`, `paywall_short_quote_only`, `requires_attribution`. The first three are hard-fail; the last two are informational.

`parent_groups` uses an H3 sub-block per parent corporation, each followed by a bullet list of owned domains. Members are matched on dot boundary by the suffix matcher — there is no need to enumerate every subdomain explicitly.

`unconfirmed_denylist` exists because our project's ML-summarization use case has too much exposure to leave unconfirmed sources in a "caution-but-allow" state. Hosts whose ToS could not be retrieved (404 / 403 / blocked / timed out / DNS failure) default to NG. A human reviewer re-fetches the ToS and either keeps the host here, promotes to explicit `denylist`, demotes to `paywall_short_quote_only`, or removes (default-allow).

## Ledger file shape (`reference/citation-policy-review.md`)