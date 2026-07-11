// `just journey:verify <vault>` (F-5, real mode): replay checks 1–11
// READ-ONLY against a real self vault's git history — the mechanism the
// 4-week live gate runs on. It reads exclusively through `git ls-tree`/`git
// show` (see vault.ts): it never constructs a SelfStore or launches the
// engine, so it cannot mutate the real vault's working tree or mode bits
// (SelfStore::open would create_dir_all + chmod). Each commit is a step; the
// checks are asserted at every step with the append-only comparison to the
// prior commit.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { runChecks, type Snapshot } from './checks.ts'
import { readVaultFromGit } from './vault.ts'

const vault = process.argv[2]
if (!vault || !fs.existsSync(vault)) {
  console.error('usage: node tests/journey/verify.ts <path-to-self-vault>')
  process.exit(2)
}

const git = (args: string[]): string =>
  execFileSync('git', ['-C', vault, ...args], { encoding: 'utf8' }).trim()

// Oldest → newest.
const commits = git(['rev-list', '--reverse', 'HEAD']).split('\n').filter(Boolean)
if (commits.length === 0) {
  console.log('verify: the vault has no history yet — nothing to replay.')
  process.exit(0)
}

let prev: Snapshot | null = null
const failures: string[] = []
let step = 0
for (const sha of commits) {
  const snap = readVaultFromGit(vault, sha)
  // A real vault is past P4 once it carries any AI-initiative node.
  const aiEdgesAllowed = snap.superposition.length > 0 || snap.interventions.length > 0
  const results = runChecks(snap, { prev, aiEdgesAllowed })
  step++
  for (const r of results) {
    if (!r.pass) failures.push(`commit ${sha.slice(0, 8)} · check ${r.check} (${r.name}): ${r.detail}`)
  }
  prev = snap
}

console.log(`journey:verify — ${step} commits replayed read-only against ${vault}`)
if (failures.length) {
  console.error(`\nVERIFY FAILED (${failures.length}):`)
  for (const f of failures) console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log(`VERIFY GREEN — checks 1–11 held across all ${step} commits (read-only; the vault was not touched).`)
