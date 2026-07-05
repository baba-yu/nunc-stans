// T5/T6 vertical slice: the orchestrator replays a golden weekday
// end-to-end (news + FP chains) from stored artifacts with zero LLM
// calls, byte-matching the committed renders and producing the same DB
// effect as the direct golden rebuild.
import { describe, expect, it } from 'vitest';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

const REPLAY_DAY = '2026-06-27'; // Saturday inside the golden DB range

function stageWritableRepo(): string {
  const repo = mkdtempSync(join(tmpdir(), 'nf-replay-'));
  mkdirSync(join(repo, 'app'), { recursive: true });
  // Writable copies — the orchestrator writes renders, run.json,
  // references.txt, and the citation ledger.
  cpSync(join(INPUT, 'sourcedata'), join(repo, 'app', 'sourcedata'), { recursive: true });
  for (const part of ['report', 'future-prediction', 'memory', 'reference'])
    cpSync(join(INPUT, part), join(repo, part), { recursive: true });
  cpSync(join(INPUT, 'references.txt'), join(repo, 'references.txt'));
  return repo;
}

describe('orchestrator replay of a golden day', () => {
  it.skipIf(goldenCaptureCollision())(
    'replays the news+fp chains with zero LLM calls and the golden DB effect',
    { timeout: 240_000 }, async () => {
      const repo = stageWritableRepo();
      const dataDir = mkdtempSync(join(tmpdir(), 'nf-data-'));
      try {
        // DB state before the replay day: the prior golden days,
        // ingested exactly like the capture recipe.
        const dbFile = join(dataDir, 'world', 'analytics.sqlite');
        initDb(dbFile);
        const db = connect(dbFile);
        const ctxBase = {
          sourcedataRoot: join(repo, 'app', 'sourcedata'),
          repoRootForRel: repo,
          todayIso: TODAY,
        };
        const allDays = daysBetween(MANIFEST.dbRange.start, MANIFEST.dbRange.end);
        for (const d of allDays.filter(d => d < REPLAY_DAY)) {
          runGlossaryExtract(db, {
            newsFile: join(repo, 'report', 'en', `news-${d.replaceAll('-', '')}.md`),
            seedYaml: join(repo, 'reference', 'glossary.yml'),
            todayIso: TODAY,
          });
          const { pidByJsonId } = ingestDay(db, ctxBase, d);
          ingestDayLocales(db, ctxBase, d, pidByJsonId);
        }

        // Run the orchestrator's news + fp chains for the replay day.
        const manifest = new RunManifest({
          date: REPLAY_DAY, mode: 'replay', runtime: 'claude-code',
          search: 'native', synthModel: null,
        });
        const ctx: RunCtx = {
          date: REPLAY_DAY,
          dow: new Date(REPLAY_DAY + 'T12:00:00Z').getUTCDay(),
          dataDir,
          newsRepo: repo,
          sourcedataRoot: join(repo, 'app', 'sourcedata'),
          dbFile,
          db,
          ai: null,
          runtime: 'claude-code',
          search: 'native',
          synthModel: null,
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
        const manifestPath = manifest.write(ctx.sourcedataRoot, REPLAY_DAY);
        expect(existsSync(manifestPath)).toBe(true);
        const written = JSON.parse(readFileSync(manifestPath, 'utf8'));
        expect(written.mode).toBe('replay');
        expect(written.steps.length).toBeGreaterThan(15);

        // Renders must byte-match the committed corpus (oracle==history
        // was proven at T1; the replay day re-renders over the copies).
        for (const kind of ['news', 'future-prediction'] as const) {
          const sub = kind === 'news' ? 'report' : 'future-prediction';
          for (const L of ['en', 'ja', 'es', 'fil']) {
            const rel = join(sub, L, `${kind}-${REPLAY_DAY.replaceAll('-', '')}.md`);
            expect(readFileSync(join(repo, rel), 'utf8'), rel)
              .toBe(readFileSync(join(INPUT, rel), 'utf8'));
          }
        }

        // references.txt must be unchanged: every cited URL was already
        // recorded upstream for this committed day.
        expect(readFileSync(join(repo, 'references.txt'), 'utf8'))
          .toBe(readFileSync(join(INPUT, 'references.txt'), 'utf8'));

        // Completing the remaining golden days + score must land on the
        // exact golden dump — the orchestrator's DB effect for the
        // replay day is identical to the direct rebuild.
        for (const d of allDays.filter(d => d > REPLAY_DAY)) {
          runGlossaryExtract(db, {
            newsFile: join(repo, 'report', 'en', `news-${d.replaceAll('-', '')}.md`),
            seedYaml: join(repo, 'reference', 'glossary.yml'),
            todayIso: TODAY,
          });
          const { pidByJsonId } = ingestDay(db, ctxBase, d);
          ingestDayLocales(db, ctxBase, d, pidByJsonId);
        }
        runScore(db);
        const got = normalizeVolatile(dumpSql(db));
        const golden = readFileSync(
          join(GOLDENS, 'expected', 'db', 'analytics.dump.sql'), 'utf8');
        expect(got).toBe(golden);
        db.close();
      } finally {
        rmSync(repo, { recursive: true, force: true });
        rmSync(dataDir, { recursive: true, force: true });
      }
    });
});
