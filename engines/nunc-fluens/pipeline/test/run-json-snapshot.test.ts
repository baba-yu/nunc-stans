// run.json snapshot semantics (post-C review fixes): the day's run.json
// is the committed locale/mode snapshot replay derives its set from —
// (a) --dry-run/--only invocations must never create or overwrite it
// (they resolve locales from TODAY'S config and would silently change
// what a later replay reproduces), and (b) the publish step writes it
// BEFORE staging so day D's snapshot rides D's own publish commit
// instead of arriving one run late.
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runDay } from '../src/orchestrator/dag.ts';
import { RunManifest, type RunCtx } from '../src/orchestrator/core.ts';
import { dailyBriefingSteps } from '../src/orchestrator/steps.ts';

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
      // A committed live day's snapshot with a DIFFERENT set than
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

describe('publish commits the day\'s own run.json', () => {
  function git(repo: string, ...args: string[]): string {
    return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
  }

  function stubCtx(repo: string, over: Partial<RunCtx> = {}): RunCtx {
    return {
      date: DATE, dow: 3, dataDir: '/nonexistent', newsRepo: repo,
      sourcedataRoot: join(repo, 'data', 'sourcedata'),
      dbFile: '/nonexistent/analytics.sqlite', db: null as never, ai: null,
      runtime: 'claude-code', search: 'native', synthModel: null,
      locales: ['ja'], replay: false, dryRun: false, todayIso: DATE,
      log: () => {}, manifest: new RunManifest({
        date: DATE, mode: 'live', runtime: 'claude-code', search: 'native',
        synthModel: null, locales: ['en', 'ja'],
      }),
      ...over,
    };
  }

  it('live: the manifest is written before the add list, so run.json rides the publish commit', async () => {
    const repo = mkdtempSync(join(tmpdir(), 'nf-publish-'));
    try {
      execFileSync('git', ['init', '-q', repo]);
      git(repo, 'config', 'user.email', 'fixture@example.com');
      git(repo, 'config', 'user.name', 'Fixture');
      const publish = dailyBriefingSteps().find(s => s.id === 'publish')!;
      // Nothing else in publishAddable exists in this bare tree — the
      // committed content can ONLY be the run.json the step itself
      // writes before building the add list.
      await publish.run(stubCtx(repo));
      const committed = git(repo, 'show', '--name-only', '--format=', 'HEAD')
        .trim().split('\n');
      expect(committed).toContain(`data/sourcedata/${DATE}/run.json`);
      const inCommit = JSON.parse(
        git(repo, 'show', `HEAD:data/sourcedata/${DATE}/run.json`));
      expect(inCommit.locales).toEqual(['en', 'ja']);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it('replay: publish short-circuits before any manifest write', async () => {
    const repo = mkdtempSync(join(tmpdir(), 'nf-publish-'));
    try {
      let writes = 0;
      const spy = { write: () => { writes += 1; return ''; } } as unknown as RunManifest;
      const publish = dailyBriefingSteps().find(s => s.id === 'publish')!;
      await publish.run(stubCtx(repo, { replay: true, manifest: spy }));
      expect(writes).toBe(0);
      expect(existsSync(join(repo, 'data'))).toBe(false); // nothing written at all
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
