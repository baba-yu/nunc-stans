// T5/T6: the orchestrator replays golden days end-to-end from stored
// artifacts with zero LLM calls — a weekday (news+fp) and the Sunday
// (news+fp+weekly chain) — byte-matching the committed renders and
// landing on the exact golden DB state.
import { describe, expect, it } from 'vitest';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { connect, initDb } from '../src/db/db.ts';
import { dumpSql } from '../src/db/dump.ts';
import { ingestDay, ingestDayLocales } from '../src/ingest/ingest-sourcedata.ts';
import { runGlossaryExtract } from '../src/ingest/glossary-extract.ts';
import { runScore } from '../src/ingest/score.ts';
import { taskPlanFor } from '../src/orchestrator/dag.ts';
import { RunManifest, type RunCtx } from '../src/orchestrator/core.ts';
import {
  daysBetween, GOLDENS, goldenCaptureCollision, INPUT, MANIFEST,
  normalizeVolatile, TODAY,
} from './helpers/build-db.ts';

const SUNDAY: string = MANIFEST.sundayDay; // weekly-chain artifacts staged
// A non-Sunday fixture day to exercise the weekday news+fp chains.
const REPLAY_DAY: string = MANIFEST.renderDays.filter((d: string) => d !== SUNDAY).at(-1);
const ALL_DAYS: string[] = daysBetween(MANIFEST.dbRange.start, MANIFEST.dbRange.end);

function stageWritableRepo(): string {
  const repo = mkdtempSync(join(tmpdir(), 'nf-replay-'));
  cpSync(join(INPUT, 'data', 'sourcedata'), join(repo, 'data', 'sourcedata'),
    { recursive: true });
  // history/ carries the citation ledger (reference-history.log) along.
  for (const part of ['daily-news', 'future-prediction', 'history', 'reference'])
    cpSync(join(INPUT, 'data', part), join(repo, 'data', part), { recursive: true });
  return repo;
}

function directDay(db: Database.Database, repo: string, d: string): void {
  const ctxBase = {
    sourcedataRoot: join(repo, 'data', 'sourcedata'),
    repoRootForRel: repo,
    todayIso: TODAY,
  };
  runGlossaryExtract(db, {
    newsFile: join(repo, 'data', 'daily-news', 'en', `news-${d.replaceAll('-', '')}.md`),
    seedYaml: join(repo, 'data', 'reference', 'glossary.yml'),
    todayIso: TODAY,
  });
  const { pidByJsonId } = ingestDay(db, ctxBase, d);
  ingestDayLocales(db, ctxBase, d, pidByJsonId);
}

async function orchestrateReplay(
  db: Database.Database, repo: string, dataDir: string, day: string,
): Promise<Record<string, any>> {
  // The golden corpus carries the full trio (pre-locale-model days:
  // derived from the staged locale dirs, as replayLocaleSet would).
  const locales = ['ja', 'es', 'fil'];
  const manifest = new RunManifest({
    date: day, mode: 'replay', runtime: 'claude-code', search: 'native', synthModel: null,
    locales: ['en', ...locales],
  });
  const ctx: RunCtx = {
    date: day,
    dow: new Date(day + 'T12:00:00Z').getUTCDay(),
    dataDir,
    newsRepo: repo,
    sourcedataRoot: join(repo, 'data', 'sourcedata'),
    dbFile: join(dataDir, 'world', 'analytics.sqlite'),
    db,
    ai: null,
    runtime: 'claude-code',
    search: 'native',
    synthModel: null,
    locales,
    replay: true,
    dryRun: false,
    todayIso: TODAY,
    log: () => {},
    manifest,
  };
  const plan = taskPlanFor(ctx.dow)
    .filter(t => t.task !== '3_daily_briefing'); // briefing needs READMEs/docs (not staged)
  for (const { task, steps } of plan) {
    for (const step of steps) {
      const started = Date.now();
      await step.run(ctx);
      manifest.record({
        id: step.id, task, kind: step.kind, status: 'ok',
        durationMs: Date.now() - started,
      });
    }
  }
  manifest.finish();
  const manifestPath = manifest.write(ctx.sourcedataRoot, day);
  return JSON.parse(readFileSync(manifestPath, 'utf8'));
}

function expectGoldenEndState(db: Database.Database): void {
  runScore(db);
  const got = normalizeVolatile(dumpSql(db));
  const golden = readFileSync(join(GOLDENS, 'expected', 'db', 'analytics.dump.sql'), 'utf8');
  expect(got).toBe(golden);
}

function expectRendersMatch(repo: string, day: string): void {
  for (const kind of ['news', 'future-prediction'] as const) {
    const sub = kind === 'news' ? join('data', 'daily-news') : join('data', 'future-prediction');
    for (const L of ['en', 'ja', 'es', 'fil']) {
      const rel = join(sub, L, `${kind}-${day.replaceAll('-', '')}.md`);
      expect(readFileSync(join(repo, rel), 'utf8'), rel)
        .toBe(readFileSync(join(INPUT, rel), 'utf8'));
    }
  }
}

describe('orchestrator replay of golden days', () => {
  it.skipIf(goldenCaptureCollision())(
    'replays the weekday news+fp chains with the golden DB effect',
    { timeout: 240_000 }, async () => {
      const repo = stageWritableRepo();
      const dataDir = mkdtempSync(join(tmpdir(), 'nf-data-'));
      try {
        const dbFile = join(dataDir, 'world', 'analytics.sqlite');
        initDb(dbFile);
        const db = connect(dbFile);
        for (const d of ALL_DAYS.filter(d => d < REPLAY_DAY)) directDay(db, repo, d);

        const manifest = await orchestrateReplay(db, repo, dataDir, REPLAY_DAY);
        expect(manifest.mode).toBe('replay');
        expect(manifest.steps.length).toBeGreaterThan(15);

        expectRendersMatch(repo, REPLAY_DAY);
        expect(readFileSync(
          join(repo, 'data', 'history', 'reference-history.log'), 'utf8'))
          .toBe(readFileSync(
            join(INPUT, 'data', 'history', 'reference-history.log'), 'utf8'));

        for (const d of ALL_DAYS.filter(d => d > REPLAY_DAY)) directDay(db, repo, d);
        expectGoldenEndState(db);
        db.close();
      } finally {
        rmSync(repo, { recursive: true, force: true });
        rmSync(dataDir, { recursive: true, force: true });
      }
    });

  it.skipIf(goldenCaptureCollision())(
    'replays the Sunday incl. the weekly chain with the golden DB effect (S-4 substrate)',
    { timeout: 240_000 }, async () => {
      const repo = stageWritableRepo();
      const dataDir = mkdtempSync(join(tmpdir(), 'nf-data-'));
      try {
        const dbFile = join(dataDir, 'world', 'analytics.sqlite');
        initDb(dbFile);
        const db = connect(dbFile);
        for (const d of ALL_DAYS.filter(d => d < SUNDAY)) directDay(db, repo, d);

        const manifest = await orchestrateReplay(db, repo, dataDir, SUNDAY);
        const tasks = new Set(manifest.steps.map((s: any) => s.task));
        for (const t of ['4_weekly_memory', '5_weekly_theme_review', '6_weekly_maintenance'])
          expect(tasks, `weekly chain ran (${t})`).toContain(t);
        expect(manifest.steps.every((s: any) => s.status === 'ok')).toBe(true);

        expectRendersMatch(repo, SUNDAY);
        expectGoldenEndState(db);
        db.close();
        expect(existsSync(join(repo, 'data', 'sourcedata', SUNDAY, 'run.json'))).toBe(true);
      } finally {
        rmSync(repo, { recursive: true, force: true });
        rmSync(dataDir, { recursive: true, force: true });
      }
    });
});
