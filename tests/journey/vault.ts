// Read a self vault into a checks Snapshot. Two readers, same shape:
//   - readVault(dir): plain fs, for the CI temp vault (`just journey`).
//   - readVaultFromGit(dir, ref): `git ls-tree`/`git show` ONLY, for the
//     read-only `just journey:verify` against a real vault — it never
//     constructs a SelfStore or launches the engine (SelfStore::open mutates:
//     create_dir_all + chmod), so it cannot alter the real vault.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type { Snapshot, Edge, Mandate, Intervention } from './checks.ts'

const git = (dir: string, args: string[]): string =>
  execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).trim()

const parse = <T>(text: string): T | null => {
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

function edgesFromJsonl(text: string): Edge[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => parse<Edge>(l))
    .filter((e): e is Edge => e !== null)
}

function flattenOutcome(commitment: string, raw: Record<string, unknown>): Snapshot['outcomes'][number] {
  return {
    commitment,
    component: String(raw.component ?? ''),
    result: String(raw.result ?? ''),
    id: typeof raw.id === 'string' ? raw.id : undefined,
    // keep the original json so check 1 (append-only) compares the WHOLE
    // outcome, not just the flattened projection.
    raw: JSON.stringify(raw),
  }
}

/** Plain-fs read of a temp/working vault. */
export function readVault(dir: string): Snapshot {
  const me = path.join(dir, 'me')
  const readDir = (sub: string): string[] => {
    const p = path.join(me, sub)
    return fs.existsSync(p) ? fs.readdirSync(p).filter((f) => f.endsWith('.json')) : []
  }
  const readJson = (rel: string): Record<string, unknown> | null =>
    fs.existsSync(path.join(me, rel)) ? parse(fs.readFileSync(path.join(me, rel), 'utf8')) : null

  const commitments = readDir('commitments')
    .map((f) => readJson(`commitments/${f}`))
    .filter((v): v is Record<string, unknown> => v !== null)

  const outcomes: Snapshot['outcomes'] = []
  const outDir = path.join(me, 'outcomes')
  if (fs.existsSync(outDir)) {
    for (const slug of fs.readdirSync(outDir)) {
      const slugDir = path.join(outDir, slug)
      if (!fs.statSync(slugDir).isDirectory()) continue
      for (const f of fs.readdirSync(slugDir).filter((f) => f.endsWith('.json'))) {
        const raw = parse<Record<string, unknown>>(fs.readFileSync(path.join(slugDir, f), 'utf8'))
        if (raw) outcomes.push(flattenOutcome(slug, raw))
      }
    }
  }

  const edgesPath = path.join(me, 'edges.jsonl')
  const edges = fs.existsSync(edgesPath) ? edgesFromJsonl(fs.readFileSync(edgesPath, 'utf8')) : []

  const mandates = readDir('mandates')
    .map((f) => readJson(`mandates/${f}`))
    .filter((v): v is Record<string, unknown> => v !== null) as unknown as Mandate[]
  const interventions = readDir('interventions')
    .map((f) => readJson(`interventions/${f}`))
    .filter((v): v is Record<string, unknown> => v !== null) as unknown as Intervention[]
  const superposition = readDir('superposition_state')
    .map((f) => readJson(`superposition_state/${f}`))
    .filter((v): v is Record<string, unknown> => v !== null)

  return {
    commitments,
    outcomes,
    edges,
    mandates,
    interventions,
    superposition,
    files: listFiles(me),
    vault: { hasRemote: hasRemote(dir), dirName: path.basename(path.resolve(dir)) },
  }
}

/** All files under me/, relative to me/ (for the stray-file check). */
function listFiles(me: string): string[] {
  if (!fs.existsSync(me)) return []
  const out: string[] = []
  const walk = (abs: string, rel: string) => {
    for (const name of fs.readdirSync(abs)) {
      const a = path.join(abs, name)
      const r = rel ? `${rel}/${name}` : name
      if (fs.statSync(a).isDirectory()) walk(a, r)
      else out.push(r)
    }
  }
  walk(me, '')
  return out
}

function hasRemote(dir: string): boolean {
  try {
    return git(dir, ['remote']).length > 0
  } catch {
    return false
  }
}

/** Read-only reader for `just journey:verify`: reconstructs the snapshot from
 * a git ref via `git ls-tree`/`git show`, touching nothing. */
export function readVaultFromGit(dir: string, ref = 'HEAD'): Snapshot {
  const tree = git(dir, ['ls-tree', '-r', '--name-only', ref, 'me/'])
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const show = (p: string): string => git(dir, ['show', `${ref}:${p}`])
  const rel = (p: string) => p.replace(/^me\//, '')

  const pick = (prefix: string) => tree.filter((p) => rel(p).startsWith(prefix) && p.endsWith('.json'))

  const commitments = pick('commitments/')
    .map((p) => parse<Record<string, unknown>>(show(p)))
    .filter((v): v is Record<string, unknown> => v !== null)

  const outcomes: Snapshot['outcomes'] = []
  for (const p of tree.filter((p) => rel(p).startsWith('outcomes/') && p.endsWith('.json'))) {
    const slug = rel(p).split('/')[1]
    const raw = parse<Record<string, unknown>>(show(p))
    if (raw) outcomes.push(flattenOutcome(slug, raw))
  }

  const edgesPath = tree.find((p) => rel(p) === 'edges.jsonl')
  const edges = edgesPath ? edgesFromJsonl(show(edgesPath)) : []

  const readLane = <T>(prefix: string): T[] =>
    pick(prefix)
      .map((p) => parse<Record<string, unknown>>(show(p)))
      .filter((v): v is Record<string, unknown> => v !== null) as unknown as T[]

  return {
    commitments,
    outcomes,
    edges,
    mandates: readLane<Mandate>('mandates/'),
    interventions: readLane<Intervention>('interventions/'),
    superposition: pick('superposition_state/')
      .map((p) => parse<Record<string, unknown>>(show(p)))
      .filter((v): v is Record<string, unknown> => v !== null),
    files: tree.map(rel),
    vault: { hasRemote: hasRemote(dir), dirName: path.basename(path.resolve(dir)) },
  }
}
