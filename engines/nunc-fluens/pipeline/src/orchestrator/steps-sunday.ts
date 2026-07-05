// Sunday chain (4_weekly_memory / 5_weekly_theme_review /
// 6_weekly_maintenance) — replay/resume implementation: the committed
// artifacts are verified and gated; the LIVE Sunday paths (dormant
// tier transitions, theme proposal + apply-schema-edit, maintenance
// judge/update) land in their own slice before the T9 cutover — the
// runner fails loudly rather than fabricating a weekly run.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { RunCtx, StepDef, StepFailure } from './core.ts';
import { postWriteIntegrity } from '../render/post-write-integrity.ts';
import {
  parseMaintenanceCandidatesFile, parseMaintenanceJudgementsFile,
} from '../schemas/sourcedata.ts';
import { readFileSync } from 'node:fs';
import { dateDir } from '../ingest/ingest-sourcedata.ts';

function stem(date: string): string {
  return date.replaceAll('-', '');
}

function requireReplayArtifact(ctx: RunCtx, id: string, path: string): void {
  if (existsSync(path)) return;
  if (ctx.replay)
    throw new StepFailure(id, `replay requires stored artifact ${path} — not found`);
  throw new StepFailure(id,
    'live Sunday flow is not ported yet (Phase C plan T5 checklist) — '
    + `and ${path} does not exist to resume from`);
}

export function weeklyMemorySteps(): StepDef[] {
  return [
    {
      id: 'dormant-snapshot', kind: 'llm',
      run: (ctx) => {
        const snapshot = join(ctx.newsRepo, 'memory', 'dormant', `dormant-${stem(ctx.date)}.md`);
        requireReplayArtifact(ctx, 'dormant-snapshot', snapshot);
        const r = postWriteIntegrity('dormant', [snapshot]);
        for (const l of r.lines) ctx.log(`  ${l}`);
        if (r.exit !== 0) throw new StepFailure('dormant-snapshot', 'integrity failed');
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
          ctx.newsRepo, 'memory', 'theme-review', `theme-review-${stem(ctx.date)}.md`);
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
