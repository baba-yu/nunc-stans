// run.json snapshot semantics (post-C review fixes; R10 git-less): the
// day's run.json is the recorded locale/mode snapshot replay derives
// its set from. It is written ONCE, by the dag at end of a FULL run —
// --dry-run/--only invocations must never create or overwrite it (they
// resolve locales from TODAY'S config and would silently change what a
// later replay reproduces). The old publish-step write-before-staging
// choreography died with the publish step itself.
import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runDay } from '../src/orchestrator/dag.ts';

const DATE = '2026-03-04'; // a Wednesday — no Sunday chain in the plan

function freshBox(): { newsRepo: string; dataDir: string; dayDir: string; root: string } {
  const root = mkdtempSync(join(tmpdir(), 'nf-runjson-'));
  const newsRepo = join(root, 'news');
  const dataDir = join(root, 'store');
  const dayDir = join(newsRepo, 'data', 'sourcedata', DATE);
  mkdirSync(dayDir, { recursive: true });
  return { newsRepo, dataDir, dayDir, root };
}

function opts(newsRepo: string, dataDir: string) {
  return {
    date: DATE, dataDir, newsRepo, ai: null, runtime: 'claude-code',
    search: 'native', synthModel: null, locales: ['es'] as readonly string[],
    replay: false, dryRun: false, only: null as string | null, log: () => {},
  };
}

describe('run.json snapshot protection (--only / --dry-run)', () => {
  it('leaves an existing run.json byte-unchanged', async () => {
    const { newsRepo, dataDir, dayDir, root } = freshBox();
    try {
      // A recorded live day's snapshot with a DIFFERENT set than
      // today's config (['es'] below) — the overwrite would be visible.
      const original = JSON.stringify(
        { date: DATE, mode: 'live', locales: ['en', 'ja'], marker: 'do-not-touch' },
        null, 2) + '\n';
      writeFileSync(join(dayDir, 'run.json'), original);

      const only = await runDay({ ...opts(newsRepo, dataDir), only: 'no-such-step' });
      expect(only.ok).toBe(true); // every step --only-skipped
      expect(readFileSync(join(dayDir, 'run.json'), 'utf8')).toBe(original);

      // Dry-run: steps genuinely run (and fail fast on this skeleton
      // tree) — the snapshot must survive the failure path too.
      const dry = await runDay({ ...opts(newsRepo, dataDir), dryRun: true });
      expect(dry.ok).toBe(false);
      expect(readFileSync(join(dayDir, 'run.json'), 'utf8')).toBe(original);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('never creates run.json where none exists', async () => {
    const { newsRepo, dataDir, dayDir, root } = freshBox();
    try {
      await runDay({ ...opts(newsRepo, dataDir), only: 'no-such-step' });
      expect(existsSync(join(dayDir, 'run.json'))).toBe(false);
      await runDay({ ...opts(newsRepo, dataDir), dryRun: true });
      expect(existsSync(join(dayDir, 'run.json'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('a full live run still writes it (even on step failure)', async () => {
    const { newsRepo, dataDir, dayDir, root } = freshBox();
    try {
      const r = await runDay(opts(newsRepo, dataDir)); // fails: no AI
      expect(r.ok).toBe(false);
      expect(existsSync(join(dayDir, 'run.json'))).toBe(true);
      const written = JSON.parse(readFileSync(join(dayDir, 'run.json'), 'utf8'));
      expect(written.locales).toEqual(['en', 'es']);
      expect(written.mode).toBe('live');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
