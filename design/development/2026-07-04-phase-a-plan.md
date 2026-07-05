# Phase A Implementation Plan — Consolidation and Naming

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One monorepo named `nunc-stans` holds every stack with the
"federation" name retired, the design corpus deduplicated, the data dir
renamed, peripheral stacks archived, a bootstrap + CI skeleton in place, and
stories S-0/S-10 passing.

**Architecture:** This is a migration, not a feature: absorb the design repo
(history-preserving subtree), sync the fourfive subtree, sweep the vocabulary,
introduce `NS_DATA`, port repo tooling to TypeScript, add bootstrap/CI/READMEs,
archive strays, and move directories last. Verification per task = commands
with expected output; stories close the phase.

**Tech Stack:** git (subtree), just, bash→TypeScript (Node 24), Rust/cargo,
pnpm via corepack, GitHub Actions.

**Plan doc convention:** repo keeps plans in `design/development/` (overrides
the skill default location).

---

## Execution notes (read first)

- All commands below run **inside WSL at the repo root** (`~/federation`
  until Task 10; `~/nunc-stans` after). When driving from a
  Windows-side session, wrap each block:
  `wsl.exe -e sh -c 'cd ~/federation && <commands>'`. Never rely on the
  Windows session cwd — Tasks 9–10 move directories.
- Commit style: `area: lowercase description` (areas seen in history:
  `design`, `contracts`, `ns`, `fe`, `ff`, `news`, `tool`; new work on
  `engines/nunc-fluens` uses `nf`). No AI attribution. Identity is already
  repo-local `yukibaba3912@gmail.com`.
- `node tools/commit-scope.ts` (Task 5+; `bash tools/commit-scope.sh` before
  that) must pass after every commit: one commit = one area unless
  `contracts/` is touched. Evidence appends to
  `design/verification/phase-a.md` are always separate `design:` commits.
- The daily News routine keeps running in `~/news` throughout — Phase A never
  touches `~/news` content (the code freeze is declared in docs only).
- Rollback: Task 0 tags `pre-phase-a`; directory moves are plain `mv` and
  reversible; `git reset --hard pre-phase-a` restores the repo state.

## File map

Create: `design/verification/phase-a.md`, `design/naming.md`,
`tools/check.ts`, `tools/commit-scope.ts`, `tools/bootstrap.sh`,
`rust-toolchain.toml`, `.node-version`, `.github/workflows/ci.yml`,
`README.md` (root), `CONTRIBUTING.md`, `frontend/README.md`,
`engines/nunc-fluens/README.md`, `design/stories/S-0.md`, `design/stories/S-10.md`,
`LICENSE` + `NOTICE` (copied from the design repo).
Modify: `justfile`, `contracts/edge.schema.json` (text only), `design/**`
(sweep + moves), `engines/nunc-fluens/FEDERATION.md → INTEGRATION.md`,
`engines/nunc-stans/src/**` (cfg(unix) pass + string sweep),
`frontend/src/**` (identifier sweep),
`design/development/2026-07-04-nuncstans-v1-plan.md` (exit-check refinement).
Delete: `tools/check.sh`, `tools/commit-scope.sh` (after ports verified).
Filesystem: `~/federation-data → ~/nunc-stans-data`; archives into `~/old/`;
`~/federation → ~/nunc-stans`; `~/nuncstans → ~/old/nuncstans-design-repo`.

---

### Task 0: Preflight snapshot and safety tag

- [ ] **Step 0.1: Verify clean tree and tag**

```bash
git status --porcelain          # expected: empty
git log -1 --oneline            # note HEAD
git tag pre-phase-a
```

- [ ] **Step 0.2: Record baselines**

```bash
git log --format='%H %s' | grep -i 'subtree' | head -5   # news/fourfive subtree adds
git -C ~/fourfive rev-parse dev                          # fourfive dev tip
git -C ~/news rev-parse dev                              # news dev tip (info only)
git -C ~/nuncstans log -1 --format='%H %s' main          # design repo tip
```

- [ ] **Step 0.3: Open the verification record**

Create `design/verification/phase-a.md`:

```markdown
# Phase A verification record

Started: 2026-07-XX. Baseline tag: `pre-phase-a` (<HEAD hash>).

## Preflight
- fourfive dev tip: <hash>
- news dev tip: <hash>
- design repo tip: <hash>
- shell profiles contain no FED_DATA export (checked 2026-07-04): true

## Evidence log
(appended per task)

## Exit criteria
(filled at close — see Task 11)
```

- [ ] **Step 0.4: Commit**

```bash
git add design/verification/phase-a.md
git commit -m "design: open the phase-a verification record"
bash tools/commit-scope.sh    # expected: ok commit-scope
```

### Task 1: FourFive subtree parity

- [ ] **Step 1.1: Find the imported split hash**

```bash
git log --grep='git-subtree-dir: engines/fourfive' --format='%H' | head -1
git log <that-hash> --format='%b' | grep git-subtree-split
```

- [ ] **Step 1.2: Compare with `~/fourfive` dev tip**

If the split hash equals `git -C ~/fourfive rev-parse dev`: record "parity
confirmed" in the verification file and skip to Step 1.5.

- [ ] **Step 1.3: Pull the delta (only if divergent)**

```bash
git subtree pull --prefix=engines/fourfive ~/fourfive dev -m "ff: sync the fourfive subtree to the standalone dev tip"
```

If this conflicts on more than a handful of files, STOP: `git merge --abort`,
record the conflict list, and flag to the owner before proceeding.

- [ ] **Step 1.4: Verify fourfive still works**

```bash
corepack pnpm -C engines/fourfive install --frozen-lockfile
corepack pnpm -C engines/fourfive typecheck   # expected: exit 0
corepack pnpm -C engines/fourfive test        # expected: all pass
```

- [ ] **Step 1.5: Record evidence and commit**

Append hashes + outcome to `design/verification/phase-a.md`;
`git add design/verification/phase-a.md && git commit -m "design: record fourfive subtree parity"`.

### Task 2: Absorb the design repo (`~/nuncstans`)

- [ ] **Step 2.1: Subtree-add with history**

```bash
git subtree add --prefix=design-import ~/nuncstans main -m "design: import the nuncstans design corpus with history"
```

- [ ] **Step 2.2: Reconcile against the existing corpus**

Counterpart mapping: `design-import/plan/contracts/* → contracts/*`,
`design-import/plan/design/* → design/*`,
`design-import/plan/engines/nunc-stans/docs/* → engines/nunc-stans/docs/*`,
`design-import/plan/README-plan.md → design/README-plan.md`.

```bash
# List files that differ from their counterpart or have none:
cd design-import/plan
find . -type f | while read -r f; do
  case "$f" in ./contracts/*) c="../../contracts/${f#./contracts/}";;
    ./design/*) c="../../design/${f#./design/}";;
    ./engines/nunc-stans/docs/*) c="../../engines/nunc-stans/docs/${f#./engines/nunc-stans/docs/}";;
    *) c="../../design/${f#./}";; esac
  if [ ! -f "$c" ]; then echo "ONLY-IN-IMPORT $f"; elif ! diff -q "$f" "$c" >/dev/null; then echo "DIFFERS $f"; fi
done
cd ../..
```

Decision rule: `ONLY-IN-IMPORT` → `git mv` to the counterpart path.
`DIFFERS` → keep the **monorepo** copy (it kept evolving after the Phase-0
copy) unless the import copy contains sections the monorepo copy lacks — then
merge those sections in by hand. Record every DIFFERS decision in the Step
2.4 commit body.

- [ ] **Step 2.3: Carry the license to the root**

```bash
cp design-import/LICENSE LICENSE && cp design-import/NOTICE NOTICE
```

- [ ] **Step 2.4: Drop the import directory and commit**

```bash
git rm -r -q design-import
git add -A
git commit -m "design: reconcile the imported corpus; canonical copies live in design/ and contracts/"
bash tools/check.sh    # expected: 3× ok
```

(The imported history stays reachable through the subtree-add commit.)

### Task 3: Naming sweep — retire "federation"

- [ ] **Step 3.1: File and directory renames**

```bash
git mv engines/news engines/nunc-fluens
git mv engines/nuncstans engines/nunc-stans
git mv design/federation design/constitution
git mv design/constitution/federation-constitution.md design/constitution/constitution.md
mkdir -p design/stories
git mv design/constitution/journey-examples.md  design/stories/journey-examples.md
git mv design/constitution/test-spec-journey.md design/stories/test-spec-journey.md
git mv contracts/federation-id.md contracts/scope-id.md
git mv engines/nunc-fluens/FEDERATION.md engines/nunc-fluens/INTEGRATION.md
# keep the build/tooling working across the dir renames:
sed -i 's|engines/nuncstans|engines/nunc-stans|g; s|engines/news|engines/nunc-fluens|g' justfile tools/check.sh tools/commit-scope.sh
sed -i 's/name = "nuncstans-engine"/name = "nunc-stans-engine"/' engines/nunc-stans/Cargo.toml
cargo build --manifest-path engines/nunc-stans/Cargo.toml >/dev/null   # refreshes Cargo.lock with the new crate name
git add -A
git commit -m "contracts: rename the engines (nunc-stans, nunc-fluens) and the federation-named files per naming.md"
```

(`contracts/` is touched, so the multi-area commit is allowed.)

- [ ] **Step 3.2: Mechanical vocabulary sweep (ordered, then reviewed)**

Apply over tracked text files, excluding `design/development/`,
`design/naming.md`, `design/verification/`:

```bash
FILES=$(git ls-files | grep -vE '^design/(development|verification)/' )
perl -pi -e '
  s/federation-data/nunc-stans-data/g;
  s/Federation:Phase/Pre-v1 Phase/g;
  s/FederationEdge/Edge/g;
  s/[Ff]ederation edge/edge/g;
  s/federation-id/scope-id/g;
  s/[Ff]ederation ID/scope ID/g;
  s/[Ff]ederation [Cc]onstitution/Nunc Stans Constitution/g;
  s/nuncstans-engine/nunc-stans-engine/g;
  s/NuncStans/Nunc Stans/g;
  s/nuncstans/nunc-stans/g;
' $FILES
git grep -iI federation -- ':!design/development' ':!design/verification' | head -50
```

- [ ] **Step 3.3: Manual catch-all pass**

Every remaining hit from Step 3.2's grep is reworded by hand ("the
federation" → "Nunc Stans" or "the contracts layer", per context). In the
same pass: capital-N "News" meaning the stack is reworded to "Nunc Fluens"
(the common noun "news" stays); `NEWS_WORLD` keeps its name until Phase C;
any leftover bare "nuncstans" may remain only when it names the old design
repo path `~/nuncstans`. Review the full diff hunk-by-hunk (`git diff`)
before staging — meaning must survive. Code identifiers (frontend
`types.ts`, engine strings/tests) are included; builds verify them in
Step 3.6.

- [ ] **Step 3.4: Write `design/naming.md`**

```markdown
# Naming map (2026-07)

The product is **Nunc Stans**; the monorepo is `~/nunc-stans`. The
integrated UI is **Nunc Stans Formans** (`frontend/nunc-stans-formans/`,
assembled in Phase B; never abbreviated to "formans"). The self-scope engine
is `engines/nunc-stans` (crate `nunc-stans-engine`); the news engine is
`engines/nunc-fluens` — *nunc fluens*, the flowing now, paired with *nunc
stans*, the standing now. manda and fourfive keep their names. The name
"federation" is retired.

| Old | New |
|---|---|
| federation (the system) | Nunc Stans |
| the federation layer / agreement | the contracts layer |
| federation edge / FederationEdge | edge / Edge |
| federation ID / federation-id | scope ID / scope-id |
| Federation Constitution | Nunc Stans Constitution |
| Federation:Phase N | Pre-v1 Phase N |
| FED_DATA | NS_DATA (deprecated fallback kept one phase) |
| ~/federation-data | ~/nunc-stans-data |
| ~/federation (repo) | ~/nunc-stans |
| ~/nuncstans (design repo) | absorbed; archived at ~/old/nuncstans-design-repo |
| integrated UI ("shell") | Nunc Stans Formans — frontend/nunc-stans-formans (Phase B) |
| GitHub remote (new, monorepo) | baba-yu/nunc-stans |
| nuncstans / NuncStans | nunc-stans / Nunc Stans (hyphenation, round 4) |
| engines/nuncstans, crate nuncstans-engine | engines/nunc-stans, crate nunc-stans-engine |
| News (the stack), engines/news | Nunc Fluens, engines/nunc-fluens |
| ~/news (external repo) | ~/nunc-fluens — renamed at Phase C (live daily routine; Pages URL changes without redirect) |
| NEWS_WORLD (env) | kept until Phase C |
| nuncstans-agent | nunc-stans-agent |
| engines/nunc-fluens/FEDERATION.md | engines/nunc-fluens/INTEGRATION.md |

Rule IDs (`F1`–`F14`, `FD-x.y`, `NS-x`, Inv N) are retained as opaque
historical identifiers; the letters no longer expand to anything.
```

- [ ] **Step 3.5: Amend the constitution §13 and refine the v1-plan exit line**

In `design/constitution/constitution.md` §13, replace the engine-independence
clause with:

> §13 (amended 2026-07): The engines are internal components of one product
> and may be modified freely by product work. The contracts still define the
> scope boundaries (world / self / artifact), and cross-engine communication
> still goes through `contracts/` only. (Original clause retired; see
> design/naming.md.)

In `design/development/2026-07-04-nuncstans-v1-plan.md`, change the Phase A
exit sentence `rg -i federation` … to:

> `git grep -iI federation -- ':!design/naming.md' ':!design/development'
> ':!design/verification'` returns nothing (migration docs may reference the
> old name historically);

- [ ] **Step 3.6: Verify builds and checks**

```bash
git grep -iI federation -- ':!design/naming.md' ':!design/development' ':!design/verification'
# expected: no output
cargo test --manifest-path engines/nunc-stans/Cargo.toml    # expected: pass
corepack pnpm -C frontend install && corepack pnpm -C frontend test && corepack pnpm -C frontend build   # pass
corepack pnpm -C engines/fourfive test                     # pass
bash tools/check.sh                                        # 3× ok
```

- [ ] **Step 3.7: Commit per area**

```bash
# stage and commit in area groups, each followed by: bash tools/commit-scope.sh
git add design contracts && git commit -m "design: retire the federation vocabulary per naming.md"
git add engines/nunc-fluens && git commit -m "nf: sweep the retired vocabulary in the nunc-fluens engine docs"
git add engines/nunc-stans && git commit -m "ns: sweep the retired vocabulary in engine strings and tests"
git add frontend && git commit -m "fe: rename FederationEdge to Edge and sweep strings"
```

(Skip any group with no changes.)

### Task 4: `NS_DATA` and the data-dir move

- [ ] **Step 4.1: Rewrite the justfile with the NS_DATA shim**

Replace the header comment and variable usage (full file after edit):

```make
set shell := ["bash", "-uc"]

# NS_DATA must point at the data-store root, which lives OUTSIDE this
# repository (FD-3.2). FED_DATA is the deprecated old name and still works
# for one phase. See design/development/setup-phase0.md.

data_dir := env_var_or_default('NS_DATA', env_var_or_default('FED_DATA', ''))

_require_data:
    @if [ -z "{{data_dir}}" ]; then echo "set NS_DATA to the data-store root"; exit 1; fi
    @if [ -z "${NS_DATA:-}" ] && [ -n "${FED_DATA:-}" ]; then echo "warning: FED_DATA is deprecated; use NS_DATA"; fi

up: _require_data build-frontend
    cargo run --manifest-path engines/nunc-stans/Cargo.toml --release -- \
      --self-dir "{{data_dir}}/self" \
      --static-dir frontend/dist \
      --port "${NS_PORT:-8720}"

build-frontend: build-world
    pnpm -C frontend install --frozen-lockfile || pnpm -C frontend install
    pnpm -C frontend build

# Flatten News's world export into frontend/public/world-headlines.json
# (§13-B: conversion on the Nunc Stans side; News is not asked to change).
build-world:
    node frontend/scripts/build-world.mjs

# Fast dev loop: Vite dev server (proxies /self + /health to the engine).
web:
    pnpm -C frontend dev

ritual: _require_data
    git -C "{{data_dir}}/self" add -A && \
    git -C "{{data_dir}}/self" commit -m "ritual: weekly review" || \
    echo "ritual: nothing to commit"

test:
    cargo test --manifest-path engines/nunc-stans/Cargo.toml
    pnpm -C frontend test

check:
    @bash tools/check.sh
```

- [ ] **Step 4.2: Move the data dir**

```bash
mv ~/federation-data ~/nunc-stans-data
ls ~/nunc-stans-data        # expected: artifact self world
git -C ~/nunc-stans-data/self remote -v   # expected: empty (F11 intact)
```

- [ ] **Step 4.3: Verify both env names boot the engine**

```bash
NS_DATA=~/nunc-stans-data timeout 90 just up & sleep 60
curl -s http://127.0.0.1:8720/health          # expected: ok/200 JSON
curl -s http://127.0.0.1:8720/self/commitments | head -c 200   # expected: 3 commitments JSON
kill %1 2>/dev/null; wait
FED_DATA=~/nunc-stans-data just _require_data  # expected: deprecation warning, exit 0
```

- [ ] **Step 4.4: Commit**

```bash
git add justfile && git commit -m "tool: introduce NS_DATA with a deprecated FED_DATA fallback"
```

### Task 5: Tooling — TypeScript ports, toolchain pins, engine Windows pass

- [ ] **Step 5.1: Pin toolchains**

```bash
rustc --version    # note the exact version, e.g. 1.XX.0
```

Create `rust-toolchain.toml` with that version, and `.node-version`:

```toml
[toolchain]
channel = "<version from rustc --version, e.g. 1.88.0>"
```

```
24
```

- [ ] **Step 5.2: Write `tools/check.ts`**

```ts
#!/usr/bin/env node
// Repo invariants (ported from tools/check.sh). Run: node tools/check.ts
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

let fail = 0
const ok = (m: string) => console.log(`ok ${m}`)
const ng = (m: string) => { console.log(`NG ${m}`); fail = 1 }

function gitGrep(args: string[]): string {
  try { return execFileSync('git', ['grep', '-nI', ...args], { encoding: 'utf8' }) }
  catch { return '' } // git grep exits 1 on no match
}

// FD-3.2: the data-store path must not leak into tracked code/config
const leak = gitGrep(['-e', 'nunc-stans-data', '-e', 'federation-data', '--',
  '.', ':!tools/check.ts', ':!design/', ':!**/prd-override.md'])
if (leak.trim()) ng(`FD-3.2: data-store path leaked into code/config\n${leak}`)
else ok('FD-3.2: no vault path leak')

// FD-7.4: frontend must not reference engine internals
const imports = gitGrep(['-E', 'engines/(nunc-fluens|nunc-stans|fourfive)', '--', 'frontend'])
const bad = imports.split('\n').filter(l => l && !l.includes('contracts/'))
if (bad.length) ng(`import: frontend references engine internals\n${bad.join('\n')}`)
else ok('import: frontend→contracts only (so far)')

// The edge schema must be valid JSON
try { JSON.parse(readFileSync('contracts/edge.schema.json', 'utf8')); ok('edge.schema.json valid') }
catch { ng('edge.schema.json invalid') }

process.exit(fail)
```

- [ ] **Step 5.3: Write `tools/commit-scope.ts`**

```ts
#!/usr/bin/env node
// 1 commit = 1 area (ported from tools/commit-scope.sh). Run: node tools/commit-scope.ts [range]
import { execFileSync } from 'node:child_process'

const range = process.argv[2] ?? 'HEAD~1..HEAD'
const files = execFileSync('git', ['diff', '--name-only', range], { encoding: 'utf8' })
  .split('\n').filter(Boolean)
const areas = new Set(files
  .map(f => f.match(/^(engines\/nunc-fluens|engines\/nunc-stans|engines\/fourfive|frontend)/)?.[1])
  .filter((a): a is string => Boolean(a)))
const hasContracts = files.some(f => f.startsWith('contracts/'))
if (areas.size > 1 && !hasContracts) {
  console.log('NG commit-scope: spans multiple areas (no contracts/)')
  console.log([...areas].join('\n'))
  process.exit(1)
}
console.log('ok commit-scope')
```

- [ ] **Step 5.4: Verify ports against the shell originals, then swap**

```bash
node tools/check.ts; bash tools/check.sh          # same verdicts (3× ok both)
node tools/commit-scope.ts; bash tools/commit-scope.sh   # both: ok commit-scope
git rm tools/check.sh tools/commit-scope.sh
```

Edit the justfile `check` recipe: `@bash tools/check.sh` → `@node tools/check.ts`.

- [ ] **Step 5.5: Engine Windows-compat pass**

```bash
grep -rn "os::unix" engines/nunc-stans/src
```

Wrap each hit so non-unix builds compile, using this pattern (adapt names to
the actual code at each site):

```rust
#[cfg(unix)]
{
    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o700))?;
}
#[cfg(not(unix))]
{
    // Windows: NTFS ACLs are the platform default; tightening is Phase B work.
}
```

```bash
cargo test --manifest-path engines/nunc-stans/Cargo.toml   # expected: pass (Linux)
```

(True Windows compilation is proven by the CI matrix after the owner pushes.)

- [ ] **Step 5.6: Commit per area**

```bash
git add tools justfile rust-toolchain.toml .node-version
git commit -m "tool: port check and commit-scope to TypeScript and pin toolchains"
git add engines/nunc-stans && git commit -m "ns: gate unix permission calls behind cfg(unix)"
node tools/commit-scope.ts   # ok commit-scope
```

### Task 6: `just bootstrap`

- [ ] **Step 6.1: Write `tools/bootstrap.sh`** (POSIX sh — the documented
  exception: it runs before the toolchain exists)

```sh
#!/bin/sh
# nunc-stans bootstrap: doctor + NS_DATA skeleton. Idempotent.
set -u
missing=0
say() { printf '%s\n' "$*"; }
need() { # need <cmd> <hint>
  if command -v "$1" >/dev/null 2>&1; then say "ok   $1 ($(command -v "$1"))"
  else say "MISS $1 — install: $2"; missing=1; fi
}
say "== toolchain =="
need git   "https://git-scm.com"
need just  "cargo install just | apt install just | brew install just"
need node  "install Node >= 24 (https://nodejs.org) then: corepack enable"
need corepack "ships with Node >= 16; corepack enable"
need cargo "https://rustup.rs"
if command -v node >/dev/null 2>&1; then
  major=$(node -e 'console.log(process.versions.node.split(".")[0])')
  [ "$major" -ge 24 ] || { say "MISS node >= 24 (found $(node --version))"; missing=1; }
fi
command -v python3 >/dev/null 2>&1 || say "warn python3 missing (needed until Phase C retires the news pipeline)"
command -v ollama  >/dev/null 2>&1 || say "info ollama not found (optional — local models)"

say "== data store =="
NS_DATA="${NS_DATA:-${FED_DATA:-$HOME/nunc-stans-data}}"
say "NS_DATA=$NS_DATA"
for d in self world artifact profiles runs; do mkdir -p "$NS_DATA/$d"; done
if [ ! -d "$NS_DATA/self/.git" ]; then
  git -C "$NS_DATA/self" init -q && say "ok   initialized $NS_DATA/self as a git repo"
fi
if [ -n "$(git -C "$NS_DATA/self" remote 2>/dev/null)" ]; then
  say "NG   $NS_DATA/self has a git remote — forbidden (F11). Remove it."; missing=1
fi
chmod 700 "$NS_DATA/self" 2>/dev/null || true

if [ "$missing" -eq 0 ]; then say "== bootstrap ok =="; else say "== bootstrap incomplete =="; fi
exit "$missing"
```

- [ ] **Step 6.2: Add the recipe** — insert into the justfile above `up`:

```make
bootstrap:
    sh tools/bootstrap.sh
```

- [ ] **Step 6.3: Verify (fresh dir + idempotence)**

```bash
NS_DATA=/tmp/ns-bootstrap-test just bootstrap   # expected: ok lines + "bootstrap ok", exit 0
NS_DATA=/tmp/ns-bootstrap-test just bootstrap   # expected: same (idempotent)
ls /tmp/ns-bootstrap-test                        # artifact profiles runs self world
rm -rf /tmp/ns-bootstrap-test
```

- [ ] **Step 6.4: Commit**

```bash
git add tools/bootstrap.sh justfile
git commit -m "tool: add just bootstrap with a doctor report and NS_DATA skeleton init"
```

### Task 7: READMEs and contribution guide

- [ ] **Step 7.1: Root `README.md`**

```markdown
# nunc-stans

**Nunc Stans** — a local-first personal system: AI reads the world and
proposes futures worth committing to (nunc-fluens); you choose or write your
own future and put resources behind it (the nunc-stans engine — the self
ledger); together you turn the path into small apps (fourfive) that human
and agent use side by side. The integrated UI where that forming happens is
**Nunc Stans Formans** (`frontend/nunc-stans-formans/`, arrives in Phase B).

Local-first, BYOL (bring your own models/keys), one vault per user.
Targets Ubuntu (native/WSL2), Windows 11, macOS.

## Quickstart

    sh tools/bootstrap.sh     # doctor + data-store init (or: just bootstrap)
    export NS_DATA=~/nunc-stans-data
    just up                   # build + serve on http://127.0.0.1:8720

## Layout

| Path | What |
|---|---|
| `engines/nunc-stans` | Rust self-scope engine (append-only ledger + vault guard) |
| `engines/nunc-fluens` | Nunc Fluens — the news pipeline (world scope). Code canonical here; `~/news` is data+publishing. **Code-frozen there since 2026-07 — code changes land here.** |
| `engines/fourfive` | FourFive design tool (artifact scope) |
| `frontend/` | ME view / world view (Vue 3 + TS); becomes **Nunc Stans Formans** (`frontend/nunc-stans-formans/`) in Phase B |
| `contracts/` | scope IDs, edge schema, glossary, agent ABI |
| `design/` | design corpus, plans, stories, verification records |

See `CONTRIBUTING.md` for conventions; `design/development/2026-07-04-nuncstans-v1-plan.md` for the roadmap.
```

- [ ] **Step 7.2: `CONTRIBUTING.md`**

```markdown
# Contributing conventions

- English for all documents and commit messages.
- Commit style: `area: lowercase description.`-free form, one sentence, no
  AI attribution. Areas: design, contracts, ns, fe, ff, nf, tool.
- One commit = one area unless `contracts/` is touched
  (`node tools/commit-scope.ts` enforces).
- `node tools/check.ts` must be green before pushing.
- Phases run on `phase/<x>` branches; stories in `design/stories/` gate
  phase closure (evidence in `design/verification/`).
- Data lives under `NS_DATA` (never in the repo). The self vault has no git
  remote — rule F11.
```

- [ ] **Step 7.3: Per-stack READMEs**

`frontend/README.md` (create): dev commands (`just web`, engine in second
terminal), build (`just build-frontend`).
`engines/nunc-fluens/README.md` (create): purpose, pointer to `INTEGRATION.md`, the
deterministic pipeline commands (`python -m src.cli update` from `app/`), and
the code-freeze note.
`engines/nunc-stans/README.md`, `engines/fourfive/README.md` (verify): update
any stale paths/env names from the sweeps (`FED_DATA`, old repo names).

- [ ] **Step 7.4: Verify every README command literally, then commit per area**

Run each documented command once; fix the README if reality disagrees.

```bash
git add README.md CONTRIBUTING.md && git commit -m "design: add the root README and contribution guide"
git add frontend/README.md && git commit -m "fe: add the frontend README"
git add engines/nunc-fluens && git commit -m "nf: add the engine README with the code-freeze note"
# ns/ff README fixes, if any, as their own commits
```

### Task 8: CI matrix workflow

- [ ] **Step 8.1: Scope the news test set**

```bash
cd engines/nunc-fluens/app && python3 -m pytest tests -q; cd ../../..
```

Record which tests fail for lack of external data (they reference `~/news`
report files). Choose the passing invocation (e.g. `-k "not integration"` or
an explicit ignore list) and record it in the verification file — the full
set returns at Phase C with golden masters.

- [ ] **Step 8.2: Write `.github/workflows/ci.yml`**

```yaml
name: ci
on:
  push: { branches: [main, newstack, 'phase/**'] }
  pull_request:
jobs:
  engine:
    strategy: { fail-fast: false, matrix: { os: [ubuntu-latest, windows-latest, macos-latest] } }
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: cargo test --manifest-path engines/nunc-stans/Cargo.toml
  web:
    strategy: { fail-fast: false, matrix: { os: [ubuntu-latest, windows-latest, macos-latest] } }
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24 }
      - run: corepack enable
      - run: corepack pnpm -C frontend install --frozen-lockfile
      - run: corepack pnpm -C frontend test
      - run: corepack pnpm -C frontend build
      - run: corepack pnpm -C engines/fourfive install --frozen-lockfile
      - run: corepack pnpm -C engines/fourfive typecheck
      - run: corepack pnpm -C engines/fourfive test
  news:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      - run: pip install jinja2 pyyaml pytest
      - run: python -m pytest tests -q   # + the Step-8.1 scoping flags
        working-directory: engines/nunc-fluens/app
  invariants:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24 }
      - run: node tools/check.ts
```

- [ ] **Step 8.3: Commit**

```bash
git add .github && git commit -m "tool: add the three-OS CI matrix workflow"
```

CI can only prove itself after the owner pushes (Task 11) — recorded as a
pending item, and any Windows/macOS failures it reveals are fixed in-phase.

### Task 9: Archive the peripheral stacks and home junk

- [ ] **Step 9.1: Moves (nothing is deleted)** — `~/fourfive` only after Task 1
  confirmed parity:

```bash
mkdir -p ~/old/home-junk-2026-07
mv ~/fourfive ~/old/fourfive
mv ~/nuncstans-hermes-stack ~/old/nuncstans-hermes-stack-remnant
mv ~/multi-stakeholder-simulater ~/old/multi-stakeholder-simulater
mv ~/honeypot ~/llmsec ~/tmp_pptx ~/old/home-junk-2026-07/
mv ~/create_deck.js ~/family-and-pets.js ~/family-and-pets.pptx \
   ~/komugi_countdown_calendar.pptx ~/llm_deck.js ~/llm_presentation_2.js \
   ~/llm_presentation_script.js ~/local-llm-deck.js \
   ~/package.json ~/package-lock.json ~/pnpm-lock.yaml ~/old/home-junk-2026-07/
mv ~/node_modules ~/old/home-junk-2026-07/node_modules
```

Untouched on purpose: `work/`, `obsidian-vault/`, `second_brain/`,
`launch-obsidian.sh`, `unsloth*`, dot-dirs, `~/news`, `~/manda`, `~/old`.

- [ ] **Step 9.2: Record the resulting `ls ~` in the verification file; commit**

```bash
git add design/verification/phase-a.md && git commit -m "design: record the home-directory archive sweep"
```

### Task 10: The directory moves (last, deliberately)

- [ ] **Step 10.1: Preconditions** — working tree clean, `just check` green,
  all prior tasks committed.

- [ ] **Step 10.2: Move both directories**

```bash
mv ~/federation ~/nunc-stans
mv ~/nuncstans ~/old/nuncstans-design-repo   # its uncommitted scratchbin goes along, as-is
```

- [ ] **Step 10.3: Post-move verification (absolute paths only)**

```bash
cd ~/nunc-stans
git status --porcelain                        # empty
git config user.email                         # yukibaba3912@gmail.com (repo-local survives the move)
node tools/check.ts                           # 3× ok
NS_DATA=~/nunc-stans-data just test            # engine + frontend tests pass
NS_DATA=~/nunc-stans-data timeout 90 just up & sleep 60
curl -s http://127.0.0.1:8720/health && curl -s http://127.0.0.1:8720/ | head -c 100
kill %1 2>/dev/null; wait
```

- [ ] **Step 10.4: Update the assistant memory files** (Claude-side): paths
  `~/federation → ~/nunc-stans`, design repo archived — in
  `MEMORY.md` + `federation-build.md`.

- [ ] **Step 10.5: Evidence commit**

```bash
git add design/verification/phase-a.md && git commit -m "design: record the phase-a directory moves"
```

Note: any Claude session anchored at the old paths must switch to absolute
paths or reopen at `~/nunc-stans` (WSL-side recommended from here on).

### Task 11: Stories, verification, owner handoff

- [ ] **Step 11.1: Write `design/stories/S-0.md` and `design/stories/S-10.md`**

```markdown
# S-0 — Cold start on this machine
From a clean checkout and an empty NS_DATA, reach the home screen in ≤ 3 commands.
1. `sh tools/bootstrap.sh` (NS_DATA set to a fresh dir) → "bootstrap ok"
2. `just up` → engine serves on :8720
3. Open http://127.0.0.1:8720 → home screen renders (empty state is fine)
Pass: all three succeed with no undocumented step.
```

```markdown
# S-10 — Pristine environment (re-run at every phase close)
On a pristine Ubuntu (container or fresh WSL distro): clone → bootstrap →
up → home screen. From Phase B: also on native Windows. At Phase F: plus
`just journey`. The 3-OS CI matrix stays green throughout.
Pass: home screen reachable with no steps beyond documented prerequisites.
```

- [ ] **Step 11.2: Execute S-0** — fresh `NS_DATA=/tmp/s0-vault`, run the three
  commands, capture output into the verification file, `rm -rf /tmp/s0-vault`.

- [ ] **Step 11.3: Execute S-10 (pristine Ubuntu container)**

```bash
docker run --rm -it -v ~/nunc-stans:/src:ro ubuntu:24.04 bash -c '
  set -e
  apt-get update && apt-get install -y git curl build-essential python3 pkg-config
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && apt-get install -y nodejs
  corepack enable
  curl https://sh.rustup.rs -sSf | sh -s -- -y && . "$HOME/.cargo/env"
  cargo install just
  git clone /src /work && cd /work
  sh tools/bootstrap.sh
  NS_DATA=$HOME/nunc-stans-data just up & sleep 240
  curl -sf http://127.0.0.1:8720/health && echo S-10-PASS
'
```

(If Docker is unavailable: `wsl --import` a fresh Ubuntu distro and run the
same steps. Either path satisfies the story; record which was used. The
in-container build is slow — allow generous sleeps/timeouts.)

- [ ] **Step 11.4: Close the verification record**

Fill `design/verification/phase-a.md` exit-criteria checklist with evidence:

```markdown
## Exit criteria
- [ ] `just up` works from ~/nunc-stans (log excerpt)
- [ ] `node tools/check.ts` green
- [ ] vocabulary grep clean (command + empty output)
- [ ] every stack README verified by running its command
- [ ] S-0 pass (transcript)  /  S-10 pass (transcript, method used)
- [ ] Pending: owner push → CI matrix green; macOS untested locally (CI-only)
## Decisions log
(reconcile choices from Task 2, news-test scoping from Task 8, deviations)
```

```bash
git add design/stories design/verification && git commit -m "design: close phase A with story evidence"
```

- [ ] **Step 11.5: OWNER handoff (Claude cannot push on this machine)**

Owner, in a native shell:

```bash
# 1. Create the private repo baba-yu/nunc-stans on GitHub (empty, no README)
wsl
cd ~/nunc-stans
git remote add origin https://github.com/baba-yu/nunc-stans.git
git push -u origin main --follow-tags
# 2. Watch the first CI run; report any Windows/macOS failures back for in-phase fixes.
```

Phase A closes when the exit criteria above are checked and the owner has
reviewed this verification record.

---

## Self-review (done at write time)

Spec coverage vs v1-plan Phase A work list: absorb ✓ (T2), parity ✓ (T1),
code freeze declared ✓ (T7 READMEs), renames+naming.md ✓ (T3), §13 ✓ (T3.5),
NS_DATA+data dir ✓ (T4), archives ✓ (T9), LICENSE ✓ (T2.3), READMEs ✓ (T7),
bootstrap+path purge ✓ (T5/T6; the run-summary hardcode lives in `~/news`,
frozen — noted for Phase C), identity ✓ (verified T10.3), remote prep ✓
(T11.5), CI ✓ (T8), S-0/S-10 ✓ (T11), moves ✓ (T10). Known deferrals:
justfile stays bash-shelled (Windows `just` support is Phase B with the
Windows S-10 gate); pnpm workspace-ification waits for Phase B packages.
