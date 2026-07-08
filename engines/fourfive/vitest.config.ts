import { defineConfig } from 'vitest/config'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Tests must never touch the real data store (phase-e execution note).
// server/db.ts resolves the workspace from FOURFIVE_WORKSPACE first, so any
// test that (transitively) imports it lands in a throwaway dir instead of
// <store>/artifact/. One dir per vitest run; the OS reaps tmp.
export default defineConfig({
  test: {
    env: {
      FOURFIVE_WORKSPACE: mkdtempSync(join(tmpdir(), 'ff-test-ws-')),
    },
  },
})
