// Sunday chain (4_weekly_memory / 5_weekly_theme_review /
// 6_weekly_maintenance). Replay verifies the committed artifacts; the
// live paths compute the week's transitions for real. Deviations from
// the conversational upstream are marked DEVIATION and recorded in the
// phase plan.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { llmJson, RunCtx, StepDef, StepFailure } from './core.ts';
import { postWriteIntegrity } from '../render/post-write-integrity.ts';
import {
  parseMaintenanceCandidatesFile, parseMaintenanceJudgementsFile,
} from '../schemas/sourcedata.ts';
import { dateDir } from '../ingest/ingest-sourcedata.ts';
import { MEMORY_DIR } from '../world-paths.ts';
import { writeAtomic } from '../render/render-news-md.ts';
import {
  addDays, AgedOutCandidate, computeTransitions, dormantDir,
  formatDormantSnapshot, hitsFor, latestDormantSnapshot, latestSummaryFor,
  originPredictions, parseDormantSnapshot, windowValidationRows,
} from '../weekly/dormant.ts';

function stem(date: string): string {
  return date.replaceAll('-', '');
}

function gitInNewsRepo(ctx: RunCtx, ...args: string[]): string {
  return execFileSync('git', ['-C', ctx.newsRepo, ...args], { encoding: 'utf8' });
}

/** Commit (no push — 5_weekly_theme_review's final push flushes the
 * Sunday commits, per the spec's Sunday ordering). */
export function commitOnly(ctx: RunCtx, stepId: string, paths: string[], message: string): void {
  gitInNewsRepo(ctx, 'add', ...paths);
  try {
    gitInNewsRepo(ctx, 'commit', '-m', message);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes('nothing to commit')) throw new StepFailure(stepId, msg);
    ctx.log('  nothing to commit (unchanged)');
  }
}

function requireReplayArtifact(ctx: RunCtx, id: string, path: string): void {
  if (existsSync(path)) return;
  if (ctx.replay)
    throw new StepFailure(id, `replay requires stored artifact ${path} — not found`);
  throw new StepFailure(id,
    'live Sunday flow is not ported yet (Phase C plan T5 checklist) — '
    + `and ${path} does not exist to resume from`);
}

function validateSignals(raw: unknown, entrantIds: string[]): Map<string, string[]> {
  const o = raw as any;
  if (!o || !Array.isArray(o.signals))
    throw new Error('output must be {signals: [{id, signals: [...]}]}');
  const byId = new Map<string, string[]>();
  for (const s of o.signals) {
    if (typeof s?.id !== 'string' || !Array.isArray(s?.signals)
      || s.signals.length < 3
      || !s.signals.every((x: unknown) => typeof x === 'string' && (x as string).trim()))
      throw new Error('each entry needs {id, signals: [>=3 non-empty strings]} — aim for 5-12');
    byId.set(s.id, s.signals.map((x: string) => x.trim()));
  }
  const missing = entrantIds.filter(id => !byId.has(id));
  if (missing.length) throw new Error(`missing signals for: ${missing.join(', ')}`);
  return byId;
}

export function weeklyMemorySteps(): StepDef[] {
  return [
    {
      id: 'dormant-snapshot', kind: 'llm',
      run: async (ctx) => {
        const snapshot = join(dormantDir(ctx.newsRepo), `dormant-${stem(ctx.date)}.md`);
        if (existsSync(snapshot) || ctx.replay) {
          // Replay / resume: the committed snapshot is the artifact.
          requireReplayArtifact(ctx, 'dormant-snapshot', snapshot);
          const r = postWriteIntegrity('dormant', [snapshot]);
          for (const l of r.lines) ctx.log(`  ${l}`);
          if (r.exit !== 0) throw new StepFailure('dormant-snapshot', 'integrity failed');
          return;
        }

        // Live: bounded reads (1 prev snapshot + the DB's validation
        // window + the aged-out slice's predictions.json files).
        const prev = latestDormantSnapshot(ctx.newsRepo, ctx.date);
        if (!prev)
          throw new StepFailure('dormant-snapshot',
            'no previous dormant snapshot found (steady-state expects one; '
            + 'bootstrap ended 2026-04-26)');
        const prevRows = parseDormantSnapshot(readFileSync(prev.path, 'utf8'));
        if (!prevRows.length)
          throw new StepFailure('dormant-snapshot',
            `previous snapshot ${prev.path} parsed to zero rows — resolve it first `
            + '(spec: don\'t silently drop entries)');
        const winStart = addDays(ctx.date, -6);
        const sliceStart = addDays(ctx.date, -13);
        const sliceEnd = addDays(ctx.date, -7);
        const windowRows = windowValidationRows(ctx.db, winStart, ctx.date);

        const poolHits = new Map(prevRows.map(r => [r.id, hitsFor({
          windowRows, sourcedataRoot: ctx.sourcedataRoot,
          dormantId: r.id, shortText: r.short,
        })]));

        const agedOut: AgedOutCandidate[] = [];
        const entrantSource = new Map<string, { title: string; body: string }>();
        for (let d = sliceStart; d <= sliceEnd; d = addDays(d, 1)) {
          originPredictions(ctx.sourcedataRoot, d).forEach((p, i) => {
            const id = `${stem(d)}-${i + 1}`;
            const short = latestSummaryFor(ctx.db, p.hash) ?? p.title;
            agedOut.push({
              id, short,
              hits: hitsFor({
                windowRows, sourcedataRoot: ctx.sourcedataRoot,
                dormantId: id, shortText: short,
              }),
            });
            entrantSource.set(id, { title: p.title, body: p.body });
          });
        }

        const t = computeTransitions({ today: ctx.date, prevRows, poolHits, agedOut });
        ctx.log(`  ${prevRows.length} in: ${t.exits.length} exits, `
          + `${t.reAnchored.length} re-anchored, ${t.advanced.length} advanced, `
          + `${t.entrants.length} entrants (${t.hotSkipped.length} stayed hot); `
          + `${t.rows.length} out`);

        // Signals for new entrants — frozen at entry (§1.4). LLM step.
        if (t.entrants.length) {
          if (ctx.dryRun) {
            for (const r of t.rows) if (!r.signals) r.signals = '(dry-run)';
          } else {
            const items = t.entrants.map(id => ({
              id,
              title: entrantSource.get(id)?.title ?? '',
              body: (entrantSource.get(id)?.body ?? '').slice(0, 1500),
            }));
            const byId = await llmJson(ctx, {
              id: 'dormant-signals',
              prompt: [
                'You are the extract-dormant-signals step of the nunc-fluens weekly',
                'memory task (design/scheduled/4_weekly_memory.md step 4).',
                `Today's date: ${ctx.date}.`,
                '',
                'For each new dormant-pool entrant below, extract distinctive terms',
                'from the prediction: proper nouns, product names, technical terms,',
                'and plausible synonyms. 5-12 signals is typical. Aim wide rather',
                'than narrow — these drive next cycles\' longshot-revival keyword',
                'scan (design/memory-policy.md §1.5 layer 1). No commas inside a',
                'single signal (the snapshot table is comma-separated).',
                '',
                JSON.stringify(items, null, 2),
                '',
                'OUTPUT: {"signals": [{"id": "<entrant id>", "signals": ["...", ...]}]}',
                'covering every entrant. Reply with ONLY the JSON document.',
              ].join('\n'),
              validate: (raw) => validateSignals(raw, t.entrants),
            });
            for (const r of t.rows)
              if (!r.signals && byId.has(r.id))
                r.signals = byId.get(r.id)!.join(', ').replaceAll('|', '/');
          }
        }

        const listOrNone = (xs: string[]) => (xs.length ? xs.join(', ') : 'none');
        const preamble = [
          `Mode: routine Sunday rotation (4_weekly_memory, nunc-fluens pipeline). `
          + `Previous snapshot dormant-${stem(prev.date)}.md (${prevRows.length} entries); `
          + `validation window ${winStart} → ${ctx.date}; aged-out origin slice `
          + `${sliceStart} → ${sliceEnd}. Transitions per design/memory-policy.md §1.3 `
          + `(max_rel ≥ 4 → exit; matched < 4 → re-anchor; due → advance 14→30→60; `
          + `aged-out with max_rel < 4 → force-dormant at 14d).`,
          '',
          `- Exits: ${listOrNone(t.exits)}`,
          `- Re-anchored: ${listOrNone(t.reAnchored)}`,
          `- Advanced: ${listOrNone(t.advanced)}`,
          `- New force-dormant entrants: ${listOrNone(t.entrants)}`,
          `- Aged out but still hot (not entered): ${listOrNone(t.hotSkipped)}`,
        ];
        const text = formatDormantSnapshot({ today: ctx.date, preamble, rows: t.rows });

        if (ctx.dryRun) {
          ctx.log('  DRY_RUN: planned snapshot follows');
          for (const l of text.split('\n')) ctx.log(`  ${l}`);
          return;
        }
        writeAtomic(snapshot, text);
        const r = postWriteIntegrity('dormant', [snapshot]);
        for (const l of r.lines) ctx.log(`  ${l}`);
        if (r.exit !== 0)
          throw new StepFailure('dormant-snapshot', 'integrity failed on the fresh snapshot');
        commitOnly(ctx, 'dormant-snapshot',
          [join(MEMORY_DIR, 'dormant', `dormant-${stem(ctx.date)}.md`)],
          `Memory rolling ${stem(ctx.date)}`);
      },
    },
  ];
}

export function themeReviewSteps(): StepDef[] {
  return [
    {
      id: 'theme-review-proposal', kind: 'llm',
      run: (ctx) => {
        const proposal = join(
          ctx.newsRepo, MEMORY_DIR, 'theme-review', `theme-review-${stem(ctx.date)}.md`);
        requireReplayArtifact(ctx, 'theme-review-proposal', proposal);
        const r = postWriteIntegrity('theme-review', [proposal]);
        for (const l of r.lines) ctx.log(`  ${l}`);
        if (r.exit !== 0) throw new StepFailure('theme-review-proposal', 'integrity failed');
      },
    },
    {
      id: 'apply-schema-edit', kind: 'det',
      run: (ctx) => {
        if (ctx.replay) {
          // The committed corpus already reflects any applied edit —
          // the DB parity gate proves the taxonomy state matches.
          ctx.log('  replay: schema state is the committed one — nothing to apply');
          return;
        }
        throw new StepFailure('apply-schema-edit',
          'live apply-schema-edit is not ported yet (taxonomy edits move to DB rows '
          + 'in the persistent-store architecture — see the Phase C plan T5 checklist)');
      },
    },
  ];
}

export function weeklyMaintenanceSteps(): StepDef[] {
  return [
    {
      id: 'maintenance-candidates', kind: 'det',
      run: (ctx) => {
        const p = join(dateDir(ctx.sourcedataRoot, ctx.date), 'maintenance-candidates.json');
        if (!existsSync(p)) {
          // Selection is skippable when the week produced no candidates.
          ctx.log('  maintenance-candidates.json absent — no candidates this week');
          return;
        }
        parseMaintenanceCandidatesFile(JSON.parse(readFileSync(p, 'utf8')));
      },
    },
    {
      id: 'maintenance-judgements', kind: 'llm',
      run: (ctx) => {
        const p = join(dateDir(ctx.sourcedataRoot, ctx.date), 'maintenance-judgements.json');
        requireReplayArtifact(ctx, 'maintenance-judgements', p);
        parseMaintenanceJudgementsFile(JSON.parse(readFileSync(p, 'utf8')));
      },
    },
    {
      id: 'maintenance-apply', kind: 'llm',
      run: (ctx) => {
        if (ctx.replay) {
          // Applied deltas live in the committed sourcedata; the day's
          // ingest already folded them in.
          ctx.log('  replay: judgement deltas are the committed sourcedata');
          return;
        }
        throw new StepFailure('maintenance-apply',
          'live maintenance updates are not ported yet (Phase C plan T5 checklist)');
      },
    },
  ];
}
