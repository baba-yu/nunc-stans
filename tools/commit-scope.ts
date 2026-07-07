#!/usr/bin/env node
// 1 commit = 1 area (ported from tools/commit-scope.sh). Run: node tools/commit-scope.ts [range]
import { execFileSync } from 'node:child_process'

const range = process.argv[2] ?? 'HEAD~1..HEAD'
const files = execFileSync('git', ['diff', '--name-only', range], { encoding: 'utf8' })
  .split('\n').filter(Boolean)
const areas = new Set(files
  .map(f => f.match(/^(engines\/nunc-fluens|engines\/nunc-stans|engines\/fourfive|frontend|gate|agents)/)?.[1])
  .filter((a): a is string => Boolean(a)))
const hasContracts = files.some(f => f.startsWith('contracts/'))
if (areas.size > 1 && !hasContracts) {
  console.log('NG commit-scope: spans multiple areas (no contracts/)')
  console.log([...areas].join('\n'))
  process.exit(1)
}
console.log('ok commit-scope')
