// Sunday chain (4_weekly_memory / 5_weekly_theme_review /
// 6_weekly_maintenance). Replay verifies the committed artifacts; the
// live paths compute the week's transitions for real. Deviations from
// the conversational upstream are marked DEVIATION and recorded in the
// phase plan.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  buildStepPrompt, llmArtifactStep, llmJson, llmMarkdown, loadMemoryPolicy,
  StepFailure,
} from './core.ts';
import type { RunCtx, StepDef } from './core.ts';
import { postWriteIntegrity, structuralErrors } from '../render/post-write-integrity.ts';
import {
  applyOps, parseProposal, planLines, restoreTaxonomy, validateTaxonomy,
} from '../weekly/apply-schema-edit.ts';
import {
  collectPainPoints, preReviewDir, snapshotThreeTimeState,
} from '../weekly/theme-review.ts';
import {
  buildJudgeContext, computeCandidates, mergeJudgementsFiles,
  mergeSpilloverIntoQueue, resolveDormantSha, validateRun,
  writeCandidatesFile, writeHealthLog,
} from '../weekly/maintenance.ts';
import {
  parseMaintenanceCandidatesFile, parseMaintenanceJudgement,
  parseMaintenanceJudgementsFile,
} from '../schemas/sourcedata.ts';
import type { MaintenanceJudgement } from '../schemas/sourcedata.ts';
import { dateDir } from '../ingest/ingest-sourcedata.ts';
import { EXPORTS_REL, MEMORY_REL } from '../world-paths.ts';
import { writeAtomic } from '../render/render-news-md.ts';
import {
  addDays, computeTransitions, dormantDir, formatDormantSnapshot, hitsFor,
  latestDormantSnapshot, latestSummaryFor, originPredictions,
  parseDormantSnapshot, windowValidationRows,
} from '../weekly/dormant.ts';
import type { AgedOutCandidate } from '../weekly/dormant.ts';

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
                'memory task (design/archive/scheduled/4_weekly_memory.md step 4).',
                `Today's date: ${ctx.date}.`,
                '',
                'For each new dormant-pool entrant below, extract distinctive terms',
                'from the prediction: proper nouns, product names, technical terms,',
                'and plausible synonyms. 5-12 signals is typical. Aim wide rather',
                'than narrow — these drive next cycles\' longshot-revival keyword',
                'scan (prompts/memory-policy.md §1.5 layer 1). No commas inside a',
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
          + `${sliceStart} → ${sliceEnd}. Transitions per prompts/memory-policy.md §1.3 `
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
          [`${MEMORY_REL}/dormant/dormant-${stem(ctx.date)}.md`],
          `Memory rolling ${stem(ctx.date)}`);
      },
    },
  ];
}

function proposalPath(ctx: RunCtx): string {
  return join(ctx.newsRepo, MEMORY_REL, 'theme-review', `theme-review-${stem(ctx.date)}.md`);
}

function validateProposal(text: string): void {
  const errs = structuralErrors('theme-review', text);
  if (errs.length)
    throw new Error(`theme-review integrity: ${errs.join('; ')}`);
  const ops = parseProposal(text);
  if (!ops.length)
    throw new Error('the `## Recommended actions` section parsed to zero '
      + 'operations — use `### Action N:` headings (or a numbered list) and '
      + 'give each schema-editing action a fenced ```action JSON block');
  for (const op of ops)
    if (op.kind !== 'log-only' && !op.block)
      throw new Error(`recommendation '${op.rawLine.slice(0, 60)}…' is a `
        + `${op.kind} without a fenced action block (required for auto-apply)`);
}

export function themeReviewSteps(): StepDef[] {
  return [
    {
      // Step 2 of the spec: rollback target + reader-facing time series.
      // Replay skips (the fixture corpus does not stage snapshot dirs;
      // the committed day already embodies them).
      id: 'theme-snapshots', kind: 'det',
      run: (ctx) => {
        if (ctx.replay || ctx.dryRun) {
          ctx.log('  skipped (replay/dry-run)');
          return;
        }
        const paths = snapshotThreeTimeState(ctx.db, ctx.newsRepo, ctx.date);
        ctx.log(`  wrote ${paths[0]} + ${EXPORTS_REL}/snapshots/${stem(ctx.date)} (retention 5)`);
        commitOnly(ctx, 'theme-snapshots', paths,
          `Snapshot pre-review state ${stem(ctx.date)}`);
      },
    },
    {
      id: 'theme-review-proposal', kind: 'llm',
      run: async (ctx) => {
        const proposal = proposalPath(ctx);
        if (existsSync(proposal) || ctx.replay) {
          requireReplayArtifact(ctx, 'theme-review-proposal', proposal);
          const r = postWriteIntegrity('theme-review', [proposal]);
          for (const l of r.lines) ctx.log(`  ${l}`);
          if (r.exit !== 0) throw new StepFailure('theme-review-proposal', 'integrity failed');
          return;
        }
        const pain = collectPainPoints(ctx.db, ctx.newsRepo);
        if (ctx.dryRun) {
          ctx.log(`  DRY_RUN: pain points — `
            + pain.scopes.map(s =>
              `${s.scope}: ${s.underused.length} underused, `
              + `${s.overpopulated.length} overpopulated, `
              + `dominant [${s.dominant.join(', ')}]`).join('; ')
            + `; ${pain.pendingCandidates.length} pending candidates`);
          return;
        }
        const text = await llmMarkdown(ctx, {
          id: 'theme-review-proposal',
          prompt: [
            'You are the compose-theme-proposal step of the nunc-fluens weekly',
            'theme review (design/archive/scheduled/5_weekly_theme_review.md steps 4-5).',
            `Today's date: ${ctx.date}.`,
            '',
            'Write data/memory/theme-review/theme-review-' + stem(ctx.date) + '.md.',
            'Required structure: H1 `# Theme review — week ending ' + ctx.date + '`,',
            'then H2 sections `## Empty / underused themes`,',
            '`## Overpopulated themes`, `## Theme candidates`, and',
            '`## Recommended actions` (at most 5 actions, each as a',
            '`### Action N: <title>` heading). Every schema-editing action MUST',
            'carry a fenced ```action JSON block per the schema in the policy',
            'excerpt below; advisory items use {"kind": "log-only"}.',
            'Supported kinds in this pipeline: rewrite-description, add,',
            'promote-candidate, log-only. Do NOT propose rename/merge/split —',
            'flag such needs as log-only observations instead.',
            '',
            '--- POLICY (prompts/memory-policy.md §2) ---',
            loadMemoryPolicy().split('## 2. Taxonomy maintenance')[1] ?? loadMemoryPolicy(),
            '--- END POLICY ---',
            '',
            '--- THIS WEEK\'S DETERMINISTIC ANALYSIS ---',
            JSON.stringify({
              scopes: pain.scopes.map(s => ({
                scope: s.scope,
                totalPredictions: s.totalPredictions,
                themes: s.themes,
                underused: s.underused,
                overpopulated: s.overpopulated,
                categoryDensity: s.categoryDensity.map(c => ({
                  ...c, share: Math.round(c.share * 1000) / 10,
                })),
                dominantCategories: s.dominant,
              })),
              pendingCandidates: pain.pendingCandidates,
              glossaryRepeatWarnings: pain.glossaryRepeatWarnings,
              currentTaxonomy: pain.taxonomy,
            }, null, 2),
            '--- END ANALYSIS ---',
            '',
            'OUTPUT: the complete markdown document, nothing else.',
          ].join('\n'),
          validate: validateProposal,
        });
        writeAtomic(proposal, text);
        const r = postWriteIntegrity('theme-review', [proposal]);
        for (const l of r.lines) ctx.log(`  ${l}`);
        if (r.exit !== 0) throw new StepFailure('theme-review-proposal', 'integrity failed');
        commitOnly(ctx, 'theme-review-proposal',
          [`${MEMORY_REL}/theme-review/theme-review-${stem(ctx.date)}.md`],
          `Theme review ${stem(ctx.date)} (proposal)`);
      },
    },
    {
      // C8: taxonomy edits land on DB rows. Manual approval mode is the
      // phase-plan default: the pipeline plans and logs, and the owner
      // applies deliberately (NF_SCHEMA_EDIT_MODE=auto opts the chained
      // run into applying, with taxonomy.json as the rollback target).
      id: 'apply-schema-edit', kind: 'det',
      run: (ctx) => {
        if (ctx.replay) {
          // The committed corpus already reflects any applied edit —
          // the DB parity gate proves the taxonomy state matches.
          ctx.log('  replay: schema state is the committed one — nothing to apply');
          return;
        }
        const proposal = proposalPath(ctx);
        if (!existsSync(proposal))
          throw new StepFailure('apply-schema-edit', `proposal not found: ${proposal}`);
        const ops = parseProposal(readFileSync(proposal, 'utf8'));
        for (const l of planLines(ops)) ctx.log(`  ${l}`);
        const mode = process.env.NF_SCHEMA_EDIT_MODE === 'auto' ? 'auto' : 'manual';
        if (ctx.dryRun || mode === 'manual') {
          ctx.log(`  ${ctx.dryRun ? 'DRY_RUN' : 'manual mode'}: plan only — apply with `
            + 'NF_SCHEMA_EDIT_MODE=auto or via `nunc-fluens run --only apply-schema-edit` '
            + 'after review');
          return;
        }
        const snapFile = join(preReviewDir(ctx.newsRepo, stem(ctx.date)), 'taxonomy.json');
        if (!existsSync(snapFile))
          throw new StepFailure('apply-schema-edit',
            `rollback target missing: ${snapFile} — run theme-snapshots first`);
        const snap = JSON.parse(readFileSync(snapFile, 'utf8'));
        const result = applyOps(ctx.db, ops, ctx.todayIso);
        for (const a of result.applied) ctx.log(`  applied: ${a.detail}`);
        for (const s of result.skipped) ctx.log(`  skipped: ${s.reason}`);
        const errs = result.failures.length ? result.failures : validateTaxonomy(ctx.db);
        if (errs.length) {
          ctx.log(`  FAIL: ${errs.join('; ')} — restoring taxonomy from snapshot`);
          restoreTaxonomy(ctx.db, snap);
          throw new StepFailure('apply-schema-edit',
            `apply failed and was rolled back: ${errs.join('; ')}`);
        }
        ctx.log(`  ${result.applied.length} applied, ${result.skipped.length} skipped; `
          + 'taxonomy validated');
      },
    },
  ];
}

async function promisePool(limit: number, thunks: Array<() => Promise<unknown>>): Promise<void> {
  const queue = [...thunks];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    for (let t = queue.shift(); t !== undefined; t = queue.shift()) await t();
  });
  await Promise.all(workers);
}

function validateJudgeFragment(expectedPid: string) {
  return (raw: unknown): unknown => {
    const o = raw as any;
    if (!o || typeof o !== 'object' || !Array.isArray(o.judgements))
      throw new Error('output must be {prediction_id, judgements: [...]}');
    if (!o.judgements.length)
      throw new Error('at least one judgement is required (reasoning at minimum)');
    o.judgements.forEach((j: unknown, i: number) => {
      const rec = parseMaintenanceJudgement(j, `judgements[${i}]`);
      if (expectedPid && rec.prediction_id !== expectedPid)
        throw new Error(`judgements[${i}].prediction_id must be '${expectedPid}' `
          + 'ON the entry — wrapper-level keys do not propagate');
    });
    return o;
  };
}

function maintenanceDir(ctx: RunCtx): string {
  return join(ctx.newsRepo, MEMORY_REL, 'maintenance');
}

export function weeklyMaintenanceSteps(): StepDef[] {
  return [
    {
      id: 'maintenance-candidates', kind: 'det',
      run: (ctx) => {
        const p = join(dateDir(ctx.sourcedataRoot, ctx.date), 'maintenance-candidates.json');
        if (existsSync(p)) {
          parseMaintenanceCandidatesFile(JSON.parse(readFileSync(p, 'utf8')));
          return;
        }
        if (ctx.replay) {
          // Selection is skippable when the committed week produced no
          // candidates file.
          ctx.log('  maintenance-candidates.json absent — no candidates this week');
          return;
        }
        // Live Step 0: change-signal gate + caps + spillover + health.
        const snapshot = join(dormantDir(ctx.newsRepo), `dormant-${stem(ctx.date)}.md`);
        let dormantSha = new Set<string>();
        if (existsSync(snapshot)) {
          dormantSha = resolveDormantSha(ctx.sourcedataRoot, readFileSync(snapshot, 'utf8'));
        } else {
          ctx.log('  WARNING: no dormant snapshot for today (4_weekly_memory '
            + 'runs first) — the 90d health check may over-fire');
        }
        const payload = computeCandidates(ctx.db, ctx.date, dormantSha);
        const spill = payload.spillover.predictions.length
          + payload.spillover.glossary_terms.length;
        ctx.log(`  candidates: ${payload.predictions.length} predictions, `
          + `${payload.glossary_terms.length} glossary terms, spillover=${spill}, `
          + `health_warnings=${payload.health_warnings.length}`);
        if (ctx.dryRun) return;
        writeCandidatesFile(dateDir(ctx.sourcedataRoot, ctx.date), payload);
        mergeSpilloverIntoQueue(
          join(maintenanceDir(ctx), 'queue.md'), payload.spillover, ctx.date);
        writeHealthLog(
          join(maintenanceDir(ctx), ctx.date, 'health.md'),
          ctx.date, payload.health_warnings);
      },
    },
    {
      id: 'maintenance-judgements', kind: 'llm',
      run: async (ctx) => {
        const dir = dateDir(ctx.sourcedataRoot, ctx.date);
        const merged = join(dir, 'maintenance-judgements.json');
        if (existsSync(merged) || ctx.replay) {
          requireReplayArtifact(ctx, 'maintenance-judgements', merged);
          parseMaintenanceJudgementsFile(JSON.parse(readFileSync(merged, 'utf8')));
          return;
        }
        const candidatesPath = join(dir, 'maintenance-candidates.json');
        if (!existsSync(candidatesPath))
          throw new StepFailure('maintenance-judgements',
            `${candidatesPath} missing — Step 0 did not run`);
        const cands = parseMaintenanceCandidatesFile(
          JSON.parse(readFileSync(candidatesPath, 'utf8')));
        if (!cands.predictions.length && !cands.glossary_terms.length) {
          if (!ctx.dryRun)
            writeAtomic(merged, JSON.stringify(
              { week_ending: ctx.date, judgements: [] }, null, 2) + '\n');
          ctx.log('  no candidates — empty judgements file');
          return;
        }
        if (ctx.dryRun) {
          ctx.log(`  DRY_RUN: would judge ${cands.predictions.length} predictions `
            + `+ ${cands.glossary_terms.length} glossary terms`);
          return;
        }
        // One judge sub-call per candidate prediction, ≤ 6 concurrent
        // (the spec's dispatch shape); each fragment is a resumable
        // artifact so a crashed Sunday re-runs only the missing ones.
        const weekContext = [-6, -5, -4, -3, -2, -1, 0].map(off => {
          const d = addDays(ctx.date, off);
          const h = join(dateDir(ctx.sourcedataRoot, d), 'headlines.json');
          const c = join(dateDir(ctx.sourcedataRoot, d), 'change_log.json');
          return {
            date: d,
            headlines: existsSync(h) ? JSON.parse(readFileSync(h, 'utf8')) : null,
            change_log: existsSync(c) ? JSON.parse(readFileSync(c, 'utf8')) : null,
          };
        });
        await promisePool(6, cands.predictions.map(cand => () =>
          llmArtifactStep(ctx, {
            id: `maintenance-judge:${cand.prediction_id}`,
            artifact: join(dir, `maintenance-judgements.${cand.prediction_id}.json`),
            validate: validateJudgeFragment(cand.prediction_id),
            prompt: () => buildStepPrompt({
              skill: 'compose-maintenance-judgement', date: ctx.date,
              extra: [
                `Candidate prediction: ${cand.prediction_id}`,
                `This week's change signals: ${cand.change_signals.join(', ')} `
                + `(confidence_drift_score ${cand.confidence_drift_score})`,
                '',
                'Full 4-stream state:',
                JSON.stringify(buildJudgeContext(ctx.db, cand.prediction_id), null, 2),
                '',
                'Last 7 days headlines + change-log (context):',
                JSON.stringify(weekContext),
              ].join('\n'),
              outputNote: `{"prediction_id": "${cand.prediction_id}", "judgements": `
                + `[{"prediction_id": "${cand.prediction_id}", "stream": `
                + '"reasoning"|"bridge"|"needs"|"readings", "entry_id": "...", '
                + '"verdict": "fresh"|"stale"|"broken"|"retire", "reason": "...", '
                + '"cross_stream_evidence": [...], "proposed_action": '
                + '"rewrite"|"retire"|"noop", "confidence": 0.0-1.0}]} — '
                + 'prediction_id AND entry_id required ON EVERY entry.',
            }),
          })));
        if (cands.glossary_terms.length) {
          await llmArtifactStep(ctx, {
            id: 'maintenance-judge:glossary',
            artifact: join(dir, 'maintenance-judgements.glossary.json'),
            validate: validateJudgeFragment(''),
            prompt: () => buildStepPrompt({
              skill: 'compose-maintenance-judgement', date: ctx.date,
              extra: 'Glossary batch. TTL-stale active terms:\n'
                + JSON.stringify(cands.glossary_terms, null, 2),
              outputNote: '{"prediction_id": "", "judgements": [{"prediction_id": "", '
                + '"stream": "glossary", "entry_id": "<term>", "verdict": ..., '
                + '"reason": ..., "cross_stream_evidence": [], "proposed_action": ..., '
                + '"confidence": ...}]} — one judgement per term.',
            }),
          });
        }
        mergeJudgementsFiles(dir);
        const bundle = parseMaintenanceJudgementsFile(
          JSON.parse(readFileSync(merged, 'utf8')));
        const counts = new Map<string, number>();
        for (const j of bundle.judgements)
          counts.set(j.verdict, (counts.get(j.verdict) ?? 0) + 1);
        ctx.log(`  merged ${bundle.judgements.length} judgements: `
          + [...counts.entries()].map(([v, n]) => `${v} ${n}`).join(' · '));
      },
    },
    {
      id: 'maintenance-apply', kind: 'llm',
      run: async (ctx) => {
        if (ctx.replay) {
          // Applied deltas live in the committed sourcedata; the day's
          // ingest already folded them in.
          ctx.log('  replay: judgement deltas are the committed sourcedata');
          return;
        }
        const dir = dateDir(ctx.sourcedataRoot, ctx.date);
        const merged = join(dir, 'maintenance-judgements.json');
        if (!existsSync(merged))
          throw new StepFailure('maintenance-apply', `${merged} missing — Step 1 did not run`);
        const bundle = parseMaintenanceJudgementsFile(
          JSON.parse(readFileSync(merged, 'utf8')));
        const report = await applyMaintenance(ctx, dir, bundle);
        ctx.log(`  applied: stale ${report.staleApplied} · retired ${report.retired} · `
          + `broken ${report.broken} (escalated, not auto-fixed)`);
        if (ctx.dryRun) return;
        writeMaintenanceSummary(ctx, report);
        const errs = validateRun({
          db: ctx.db, sourcedataRoot: ctx.sourcedataRoot,
          newsRepo: ctx.newsRepo, weekEnding: ctx.date,
        });
        if (errs.length)
          throw new StepFailure('maintenance-apply',
            `Step 3 validate failed: ${errs.join('; ')}`);
        commitOnly(ctx, 'maintenance-apply',
          [`${MEMORY_REL}/maintenance`],
          `Weekly maintenance ${stem(ctx.date)}`);
      },
    },
  ];
}

interface MaintenanceReport {
  total: number;
  fresh: number;
  staleApplied: number;
  retired: number;
  broken: number;
  notes: string[];
}

/** Step 2 — apply the non-fresh verdicts. stale reasoning/bridge deltas
 * are LLM rewrites applied to the DB columns + recorded as
 * maintenance-update artifacts; stale needs/readings deltas are
 * recorded as artifacts and escalated in the summary (their DB
 * application needs its own design pass — recorded deviation); retire
 * hits the glossary status (or a marker file for non-glossary streams);
 * broken is escalated to broken.md, never auto-fixed. */
async function applyMaintenance(
  ctx: RunCtx, dir: string,
  bundle: { week_ending: string; judgements: MaintenanceJudgement[] },
): Promise<MaintenanceReport> {
  const report: MaintenanceReport = {
    total: bundle.judgements.length,
    fresh: 0, staleApplied: 0, retired: 0, broken: 0, notes: [],
  };
  const brokenEntries: MaintenanceJudgement[] = [];

  // Over-eager-judge downgrade (spec failure mode): 4 stale verdicts on
  // one prediction, all confidence < 0.7 → treat as broken + escalate.
  const stalePerPid = new Map<string, MaintenanceJudgement[]>();
  for (const j of bundle.judgements)
    if (j.verdict === 'stale')
      stalePerPid.set(j.prediction_id,
        [...(stalePerPid.get(j.prediction_id) ?? []), j]);
  const downgraded = new Set<MaintenanceJudgement>();
  for (const [pid, js] of stalePerPid) {
    if (js.length >= 4 && js.every(j => j.confidence < 0.7)) {
      for (const j of js) downgraded.add(j);
      report.notes.push(`${pid}: 4 low-confidence stale verdicts downgraded to `
        + 'broken (likely judge prompt regression)');
    }
  }

  for (const j of bundle.judgements) {
    const verdict = downgraded.has(j) ? 'broken' : j.verdict;
    if (verdict === 'fresh') { report.fresh++; continue; }
    if (verdict === 'broken') { report.broken++; brokenEntries.push(j); continue; }
    if (ctx.dryRun) continue;
    if (verdict === 'retire') {
      if (j.stream === 'glossary') {
        ctx.db.prepare(
          `UPDATE glossary_terms SET status='retired', reviewed_by_human=1,
             updated_at=? WHERE term=?`).run(ctx.todayIso, j.entry_id);
      } else {
        writeAtomic(join(dir, `retired.${j.stream}.${j.prediction_id}.json`),
          JSON.stringify({ ...j, retired_at: ctx.todayIso }, null, 2) + '\n');
      }
      report.retired++;
      continue;
    }
    // stale → LLM rewrite delta, recorded as an artifact; reasoning and
    // bridge deltas also land on their DB columns.
    const artifact = join(dir, `maintenance-update.${j.stream}.${j.prediction_id}.json`);
    const delta = await llmJson(ctx, {
      id: `maintenance-update:${j.stream}:${j.prediction_id}`,
      prompt: buildStepPrompt({
        skill: 'apply-maintenance-update', date: ctx.date,
        extra: [
          `Judgement to apply (stream=${j.stream}):`,
          JSON.stringify(j, null, 2),
          '',
          'Current state:',
          JSON.stringify(buildJudgeContext(ctx.db, j.prediction_id), null, 2),
        ].join('\n'),
        outputNote: j.stream === 'reasoning'
          ? '{"prediction_id", "reasoning_because", "reasoning_given", '
          + '"reasoning_so_that", "reasoning_landing"} — rewritten per the '
          + 'judgement reason; keep untouched dimensions verbatim.'
          : j.stream === 'bridge'
            ? '{"validation_row_id", "bridge_text"} — the rewritten bridge paragraph.'
            : '{"prediction_id", "stream", "delta": {...}} — the rewritten entries.',
      }),
      validate: (raw) => {
        const o = raw as any;
        if (!o || typeof o !== 'object') throw new Error('delta must be an object');
        if (j.stream === 'reasoning')
          for (const k of ['reasoning_because', 'reasoning_given',
            'reasoning_so_that', 'reasoning_landing'])
            if (typeof o[k] !== 'string' || !o[k].trim())
              throw new Error(`reasoning delta missing '${k}'`);
        if (j.stream === 'bridge' && (typeof o.bridge_text !== 'string' || !o.bridge_text.trim()))
          throw new Error('bridge delta missing bridge_text');
        return o;
      },
    }) as any;
    writeAtomic(artifact, JSON.stringify(delta, null, 2) + '\n');
    if (j.stream === 'reasoning') {
      ctx.db.prepare(
        `UPDATE predictions SET reasoning_because=?, reasoning_given=?,
           reasoning_so_that=?, reasoning_landing=?, updated_at=?
         WHERE prediction_id=?`,
      ).run(delta.reasoning_because, delta.reasoning_given,
        delta.reasoning_so_that, delta.reasoning_landing,
        ctx.todayIso, j.prediction_id);
    } else if (j.stream === 'bridge') {
      ctx.db.prepare(
        `UPDATE validation_rows SET bridge_text=? WHERE validation_row_id=?`,
      ).run(delta.bridge_text, str(delta.validation_row_id) ?? j.entry_id);
    } else {
      report.notes.push(`${j.prediction_id} (${j.stream}): delta recorded as `
        + 'artifact; DB application for this stream is a recorded deviation');
    }
    report.staleApplied++;
  }

  if (!ctx.dryRun && brokenEntries.length) {
    const brokenPath = join(maintenanceDir(ctx), ctx.date, 'broken.md');
    const lines = [
      `# Maintenance — broken entries (week ending ${ctx.date})`, '',
      'Flagged `broken` by the Step-1 Judge. Per 6_weekly_maintenance.md '
      + '§Step 2, broken verdicts are logged for human review and NOT auto-fixed.', '',
      '| Prediction | Stream | Entry | Reason |',
      '|---|---|---|---|',
      ...brokenEntries.map(j =>
        `| ${j.prediction_id} | ${j.stream} | ${j.entry_id} | `
        + `${j.reason.replaceAll('|', '/')} |`),
      '',
    ];
    writeAtomic(brokenPath, lines.join('\n'));
  }
  return report;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null;
}

function writeMaintenanceSummary(ctx: RunCtx, r: MaintenanceReport): void {
  const path = join(maintenanceDir(ctx), ctx.date, 'summary.md');
  const lines = [
    `# Weekly maintenance — week ending ${ctx.date}`, '',
    `- Judgements: ${r.total} (fresh ${r.fresh} · stale-applied ${r.staleApplied} `
    + `· retired ${r.retired} · broken ${r.broken}).`,
    ...(r.notes.length ? ['', '## Notes', '', ...r.notes.map(n => `- ${n}`)] : []),
    '',
  ];
  writeAtomic(path, lines.join('\n'));
}
