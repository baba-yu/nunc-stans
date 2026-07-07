// The day runner: day-of-week task plan, step iteration with the
// run.json manifest, DRY_RUN / --only / replay modes.
import { connect } from '../db/db.ts';
import { sourcedataDir, worldDbFile } from '../config.ts';
import { RunManifest } from './core.ts';
import type { RunCtx, StepDef } from './core.ts';
import { dailyUpdateSteps, futurePredictionSteps, dailyBriefingSteps } from './steps.ts';
import {
  themeReviewSteps, weeklyMaintenanceSteps, weeklyMemorySteps,
} from './steps-sunday.ts';
import { replayLocaleSet, resolveLocaleSet } from '../world-paths.ts';
import type { Ai } from 'nunc-ai';

export interface DayPlanTask {
  task: string;
  steps: StepDef[];
}

export function taskPlanFor(dow: number): DayPlanTask[] {
  const daily: DayPlanTask[] = [
    { task: '1_daily_update', steps: dailyUpdateSteps() },
    { task: '2_future_prediction', steps: futurePredictionSteps() },
  ];
  if (dow === 0) {
    // Sunday ordering per 0_daily_master: 1 → 2 → 4 → 5 → 6 → 3.
    // Replay verifies the committed weekly artifacts; live computes
    // the week's transitions (dormant rotation, theme review +
    // apply-schema-edit on DB rows, maintenance judge/apply).
    daily.push({ task: '4_weekly_memory', steps: weeklyMemorySteps() });
    daily.push({ task: '5_weekly_theme_review', steps: themeReviewSteps() });
    daily.push({ task: '6_weekly_maintenance', steps: weeklyMaintenanceSteps() });
  }
  daily.push({ task: '3_daily_briefing', steps: dailyBriefingSteps() });
  return daily;
}

export interface RunDayOptions {
  date: string;
  dataDir: string;
  newsRepo: string;
  ai: Ai | null;
  runtime: string;
  search: string;
  synthModel: string | null;
  /** The configured non-EN render set (already validated by the
   * caller). Absent = the default trio. Ignored in replay, where the
   * effective set is derived from the day's committed state. */
  locales?: readonly string[];
  replay: boolean;
  dryRun: boolean;
  only?: string | null;
  log?: (s: string) => void;
}

export interface RunDayResult {
  ok: boolean;
  manifestPath: string;
  failedStep?: string;
}

export async function runDay(opts: RunDayOptions): Promise<RunDayResult> {
  const log = opts.log ?? ((s: string) => console.log(s));
  const dow = new Date(opts.date + 'T12:00:00Z').getUTCDay();
  const sourcedataRoot = sourcedataDir(opts.newsRepo);
  // Replay determinism: the day's committed set (run.json > staged
  // locale dirs > default) wins over today's preference.
  const locales = opts.replay
    ? replayLocaleSet(sourcedataRoot, opts.date)
    : resolveLocaleSet(opts.locales);
  const manifest = new RunManifest({
    date: opts.date,
    mode: opts.replay ? 'replay' : opts.dryRun ? 'dry-run' : 'live',
    runtime: opts.runtime,
    search: opts.search,
    synthModel: opts.synthModel,
    locales: ['en', ...locales],
  });
  const dbFile = worldDbFile(opts.dataDir);
  const db = connect(dbFile);
  const ctx: RunCtx = {
    date: opts.date,
    dow,
    dataDir: opts.dataDir,
    newsRepo: opts.newsRepo,
    sourcedataRoot,
    dbFile,
    db,
    ai: opts.ai,
    runtime: opts.runtime,
    search: opts.search,
    synthModel: opts.synthModel,
    locales,
    replay: opts.replay,
    dryRun: opts.dryRun,
    todayIso: new Date().toISOString().slice(0, 10),
    log,
    manifest,
  };
  let failedStep: string | undefined;
  try {
    outer:
    for (const { task, steps } of taskPlanFor(dow)) {
      log(`== ${task} ==`);
      for (const step of steps) {
        if (opts.only && step.id !== opts.only) {
          manifest.record({
            id: step.id, task, kind: step.kind, status: 'skipped', durationMs: 0,
            detail: '--only filter',
          });
          continue;
        }
        const started = Date.now();
        try {
          await step.run(ctx);
          manifest.record({
            id: step.id, task, kind: step.kind, status: 'ok',
            durationMs: Date.now() - started,
          });
          log(`ok ${step.id}`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          manifest.record({
            id: step.id, task, kind: step.kind, status: 'failed',
            durationMs: Date.now() - started, detail: msg.slice(0, 500),
          });
          log(`FAIL ${step.id}: ${msg}`);
          failedStep = step.id;
          break outer;
        }
      }
    }
  } finally {
    db.close();
    manifest.finish();
  }
  const manifestPath = manifest.write(ctx.sourcedataRoot, opts.date);
  return { ok: failedStep === undefined, manifestPath, failedStep };
}
