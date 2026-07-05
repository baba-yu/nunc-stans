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
// (tools/ legitimately names the string in order to check for it)
const leak = gitGrep(['-e', 'nunc-stans-data', '-e', 'federation-data', '--',
  '.', ':!tools/', ':!design/', ':!**/prd-override.md'])
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
