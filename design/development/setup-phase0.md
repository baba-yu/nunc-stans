# Procedure: Federation:Phase 0 (building the foundation)
Until the federation monorepo is created, the two existing repositories are imported, three data stores are prepared, and `just check` and `just up` pass.
Prerequisite documents: Constitution v0.3.1 / Development Progress Doc v0.1 (development-plan.md) / each PRD override.
Intended runner: Claude Code. Each step is one commit. Proceed to the next only after the verification command goes green.

---

## 0. Before starting — fix the actual paths here (the one manual task)

Replace the below with the actual values of your own environment. The rest of the procedure is written with these variables.

```bash
# === edit here ===
export NEWS_SRC=~/path/to/news          # existing News repository
export FF_SRC=~/path/to/fourfive        # existing FourFive repository
export FED=~/federation                 # monorepo to be created (create it if absent)
export DATA=~/federation-data           # data store (outside the repository. important)
# === end of edits ===

# if there are SPL/NuncStans specs (SPL_v2_extracted.txt etc.):
export SPL_DOCS=~/path/to/spl-docs      # may stay empty if there are none
```

Confirm:
```bash
ls "$NEWS_SRC/.git" "$FF_SRC/.git"   # both must exist
echo "$FED" "$DATA"                   # the two must be different locations (neither inside the other)
```

**Most important instruction to Claude Code**: `$DATA` (= ~/federation-data) is **outside** the monorepo. The self / world / artifact "data stores" that come up during code work all point to this external directory. Do not create data inside the repository. The contamination check (step 8 / FD-3.2, described later) guarantees this.

---

## Step 1 — The skeleton of the monorepo

```bash
mkdir -p "$FED" && cd "$FED"
[ -d .git ] || git init
mkdir -p design contracts engines frontend tests
```

Copy the existing design documents into `design/` (from outputs):
- federation-constitution-v0.3.1.md → design/federation-constitution.md
- federation-dev-policy-v1.0.md → design/federation-dev-policy.md (planned — not yet in repo)
- design/federation/test-spec-journey.md → design/ (federation system-level test spec)
- test-spec-nuncstans.md / test-spec-news.md / test-spec-fourfive.md → design/ (planned — not yet in repo)
- test-spec-journey-v2.3.md → design/test-spec-journey.md
- journey-examples.md → design/

Verify: the above are lined up in `ls design/`.
Commit: `git add -A && git commit -m "design: scaffold federation, add constitution and specs"`

---

## Step 2 — Place contracts/

In `contracts/`:
- contracts-glossary.md → contracts/glossary.md
- Create contracts/federation-id.md anew (content of Constitution §2: `<scope>/<type>/<original-id>`, no renaming, free slugs for backfill)
- Create contracts/agent-abi.md anew (the reserved text of Constitution §13-D as-is. The content is an empty declaration)
- Create contracts/edge.schema.json anew (below)

edge.schema.json (the edge record of Constitution §3):
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "federation edge",
  "type": "object",
  "required": ["id", "type", "from", "to", "to_label", "author", "created_at"],
  "additionalProperties": false,
  "properties": {
    "id":         { "type": "string" },
    "type":       { "enum": ["informed_by","serves","produced","closes","supersedes","dismisses"] },
    "from":       { "type": "string", "pattern": "^(world|self|artifact)/[a-z_]+/.+" },
    "to":         { "type": "string", "pattern": "^(world|self|artifact)/[a-z_]+/.+" },
    "to_label":   { "type": "string", "minLength": 1 },
    "from_label": { "type": "string" },
    "author":     { "enum": ["user","ai","sensor"] },
    "created_at": { "type": "string" },
    "note":       { "type": "string" }
  }
}
```

Verify: `cat contracts/edge.schema.json | python3 -m json.tool >/dev/null && echo ok`
Commit: `contracts: add glossary, id rule, edge schema, reserved agent-abi`

---

## Step 3 — Import News (with history)

```bash
cd "$FED"
git subtree add --prefix=engines/news "$NEWS_SRC" $(git -C "$NEWS_SRC" rev-parse --abbrev-ref HEAD)
```
(Allowing for environments where the branch name is not main, it automatically passes the source repository's current branch.)

Verify: the original app/ etc. are visible in `ls engines/news/`. The import commit is in `git log --oneline | head`.
The commit is created automatically by subtree add.

Note: at this point the path references in the code inside engines/news may stay original. Making it run is the job of a later Phase. The goal of Federation:Phase 0 is only up to the frame of placement and launch.

---

## Step 4 — Import FourFive (with history)

```bash
cd "$FED"
git subtree add --prefix=engines/fourfive "$FF_SRC" $(git -C "$FF_SRC" rev-parse --abbrev-ref HEAD)
```

Verify: the original server/ src/ etc. are visible in `ls engines/fourfive/`.

**Handling the data folder**: if FourFive's data (SQLite + versions) is inside engines/fourfive, exclude it from tracking with .gitignore and configure it to point at `$DATA/artifact/` (this re-pointing may also be done in Federation:Phase 4. In Federation:Phase 0, only confirm "the DB's actual body is not in the tracked set").
Verify: `git ls-files engines/fourfive | grep -i '\.sqlite\|\.db$'` is empty.

---

## Step 5 — PRD overrides and specs into each engine

```bash
mkdir -p engines/news/docs engines/nuncstans/docs engines/fourfive/docs
```
- prd-override-news.md → engines/news/docs/prd-override.md (planned — not yet in repo)
- prd-override-fourfive.md → engines/fourfive/docs/prd-override.md (planned — not yet in repo)
- prd-override-nuncstans.md → engines/nuncstans/docs/prd-override.md
- If there are SPL specs: `[ -n "$SPL_DOCS" ] && cp "$SPL_DOCS"/* engines/nuncstans/docs/`

Placement of each test spec (following the development policy's location, placed in each engine separately from the source of truth in design/):
- test-spec-news.md → engines/news/docs/test-spec.md (planned — not yet in repo)
- test-spec-fourfive.md → engines/fourfive/docs/test-spec.md (planned — not yet in repo)
- test-spec-nuncstans.md → engines/nuncstans/docs/test-spec.md (planned — not yet in repo)

Commit: `docs: place PRD overrides and per-engine test specs`

---

## Step 6 — A minimal store for nuncstans-engine

In Federation:Phase 0, the content of nuncstans is not built (the language is decided in Federation:Phase 2). Only an empty frame:
```bash
mkdir -p engines/nuncstans
cat > engines/nuncstans/README.md << 'INNER'
# nuncstans-engine
Manages the source of truth (canonical record) of edge, commitment, and mandate (implementation starts in Federation:Phase 2).
The source-of-truth data lives at ~/federation-data/self/ (outside this repository, no remote. F11).
The language is decided at the start of Federation:Phase 2 (candidate: Hono).
INNER
```
Commit: `ns: placeholder for nuncstans-engine`

---

## Step 7 — Three data stores (outside the repository)

```bash
mkdir -p "$DATA/self" "$DATA/world" "$DATA/artifact"

# self: git init, no remote (F11). Do not make it a hidden folder (already visible at federation-data/self)
git -C "$DATA/self" rev-parse --git-dir >/dev/null 2>&1 || git -C "$DATA/self" init
# first empty commit (the origin point of the time-lapse)
git -C "$DATA/self" commit --allow-empty -m "self: vault init" 2>/dev/null || true

# world: the data side of the existing news repository. Not a fresh clone; keep using the existing repository as data-only.
#   → the news code moved into the monorepo in step3. Leave the original repository ($NEWS_SRC) as the world source of truth as-is.
#   $DATA/world is optional (a clone target if you want to gather operations in one place). For now you may reference $NEWS_SRC directly as the world source of truth.

# artifact: FourFive's actual data. Per the step4 policy, it may stay in its current location. $DATA/artifact is a future consolidation target.
```

Verify (the crux of F11):
```bash
test -z "$(git -C "$DATA/self" remote)" && echo "self: no remote OK"   # must be empty
echo "$DATA/self" | grep -qv '/\.' && echo "self: not hidden OK"
```

**Instruction to Claude Code**: the `$DATA/self` created here is from now on the sole source of truth for the self scope. Do not mistake the commit target and place self data on the `$FED` side.

---

## Step 8 — The justfile and check scripts

`$FED/justfile` (minimal):
```make
set shell := ["bash", "-uc"]

up:
    @echo "starting federation (phase0: stub)"
    # From Federation:Phase 1 onward, launch frontend / engines. In Federation:Phase 0 this is a placeholder treated as success.

ritual:
    @echo "weekly review (phase0: stub)"
    # From Federation:Phase 1 onward, append commitment + back up.

test:
    @echo "no unit tests yet (phase0)"

check:
    @bash tools/check.sh
```

`$FED/tools/check.sh` (the checks implemented in Federation:Phase 0 = the foundation of FD-3.2 / FD-7.1–7.4):
```bash
#!/usr/bin/env bash
set -uo pipefail
fail=0

# FD-3.2: whether the self data-store string has contaminated the tracked set
if git grep -nI "federation-data" -- . ':!tools/check.sh' ':!design/*' ':!**/prd-override.md' >/dev/null 2>&1; then
  echo "NG FD-3.2: 'federation-data' has leaked into code/config"; fail=1
else
  echo "ok FD-3.2: no vault path leak"
fi

# FD-7.4 (foundation): naive detection of engine-to-engine imports / references from frontend into engine internals
#   The full version uses per-language analysis. Federation:Phase 0 is a minimal string-based check.
if grep -rnE "engines/(news|nuncstans|fourfive)" frontend 2>/dev/null | grep -v "contracts/" >/dev/null; then
  echo "NG import: frontend references engine internals directly"; fail=1
else
  echo "ok import: frontend→contracts only (so far)"
fi

# whether the edge schema is valid JSON
if python3 -m json.tool contracts/edge.schema.json >/dev/null 2>&1; then
  echo "ok edge.schema.json valid"
else
  echo "NG edge.schema.json invalid"; fail=1
fi

exit $fail
```

```bash
chmod +x "$FED/tools/check.sh"
```

Verify (the definition of Federation:Phase 0's green):
```bash
cd "$FED"
just check   # all ok, exit 0
just up      # the stub succeeds
```
Commit: `tool: justfile + phase0 checks (vault-leak, import, schema)`

---

## Step 9 — The commit-prefix check (the foundation of FD-7.1–7.3)

The prefix rule of development policy §3 (`news:` `ff:` `ns:` `fe:` `contracts:` `design:` `tool:`) and the 1-commit-1-area rule. In Federation:Phase 0, just place a template pre-commit hook (full operation is optional):

`$FED/tools/commit-scope.sh` (judges whether the area the latest commit touched is one, or matches the prefix. Called from CI/hook):
```bash
#!/usr/bin/env bash
set -uo pipefail
range="${1:-HEAD~1..HEAD}"
files=$(git diff --name-only $range)
areas=$(echo "$files" | grep -oE '^(engines/news|engines/nuncstans|engines/fourfive|frontend)' | sort -u)
n=$(echo "$areas" | grep -c . )
has_contracts=$(echo "$files" | grep -c '^contracts/')
if [ "$n" -gt 1 ] && [ "$has_contracts" -eq 0 ]; then
  echo "NG commit-scope: spans multiple areas (no contracts/)"; echo "$areas"; exit 1
fi
echo "ok commit-scope"
```
```bash
chmod +x "$FED/tools/commit-scope.sh"
```
Verify: `bash tools/commit-scope.sh` is ok.
Commit: `tool: commit-scope checker (1 commit = 1 area)`

---

## Step 10 — Confirming Federation:Phase 0 completion

Everything must be green:
```bash
cd "$FED"
just check                        # exit 0
just up                           # success
test -z "$(git -C "$DATA/self" remote)" && echo "F11 ok"
ls design/ contracts/ engines/news engines/fourfive engines/nuncstans
git log --oneline | head -20      # 2 subtrees + the commits of each step
```

Federation:Phase 0 completion conditions (development policy §2.3):
- [ ] `just up` launches (a stub is fine)
- [ ] `just check` passes
- [ ] The three data locations are initialized (self has no remote, git init done)
- [ ] Design docs, contracts, PRD overrides, and test specs are placed and committed

If green up to here, on to Federation:Phase 1.

---

## Next (only the first move of Federation:Phase 1)

Federation:Phase 1 is "the first operation check." The first commit is neither the ME view nor the API but **three past manual entries into the self store** (T1 of the journey):
```
$DATA/self/me/commitments/2025-08-gpu-server.json
$DATA/self/me/commitments/2026-04-edge-ai-stack.json
$DATA/self/me/commitments/2026-06-federation-local.json
$DATA/self/me/edges.jsonl
```
The format follows journey-examples / Constitution §3 (close is 2 items, external form + felt sense; an edge requires to_label). After these are in, build a single ME view (T2). If a detailed procedure is needed, the Federation:Phase 1 procedure will be issued separately.

---

## Notes when handing this to Claude Code (summary)
1. Only the variable block at the top is filled by a human. The rest may be touched
2. `~/federation-data/` is outside the repository. Do not let self data be created inside the repository (check.sh is the bulwark)
3. Each step = 1 commit. Proceed to the next only after the verification command goes green
4. subtree add imports the history, so do not delete the original repositories (news is active as the data source of truth, fourfive is judged after a 4-week wait-and-see)
5. Federation:Phase 0's goal is not "a working app" but "the frame and checks standing up." Implementation of the content is from Federation:Phase 1 onward
