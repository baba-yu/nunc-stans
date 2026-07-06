// Sunday chain (4_weekly_memory / 5_weekly_theme_review /
// 6_weekly_maintenance). Replay verifies the committed artifacts; the
// live paths compute the week's transitions for real. Deviations from
// the conversational upstream are marked DEVIATION and recorded in the
// phase plan.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  llmJson, llmMarkdown, loadMemoryPolicy, RunCtx, StepDef, StepFailure,
} from './core.ts';
import { postWriteIntegrity, structuralErrors } from '../render/post-write-integrity.ts';
import {
  applyOps, parseProposal, planLines, restoreTaxonomy, validateTaxonomy,
} from '../weekly/apply-schema-edit.ts';
import {
  collectPainPoints, preReviewDir, snapshotThreeTimeState,
} from '../weekly/theme-review.ts';
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

function proposalPath(ctx: RunCtx): string {
  return join(ctx.newsRepo, MEMORY_DIR, 'theme-review', `theme-review-${stem(ctx.date)}.md`);
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
        ctx.log(`  wrote ${paths[0]} + docs/data/snapshots/${stem(ctx.date)} (retention 5)`);
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
            'theme review (design/scheduled/5_weekly_theme_review.md steps 4-5).',
            `Today's date: ${ctx.date}.`,
            '',
            'Write memory/theme-review/theme-review-' + stem(ctx.date) + '.md.',
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
            '--- POLICY (design/memory-policy.md §2) ---',
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
          [join(MEMORY_DIR, 'theme-review', `theme-review-${stem(ctx.date)}.md`)],
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
