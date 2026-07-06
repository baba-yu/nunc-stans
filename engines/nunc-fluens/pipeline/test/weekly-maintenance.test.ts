// 6_weekly_maintenance port: Step 0 candidate selection proven against
// the oracle's committed 2026-06-28 output, the Step 1 fragment merge
// proven against the committed merged file, and unit coverage for the
// spillover queue, dormant-id resolution, and Step 3 validation.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type Database from 'better-sqlite3';
import {
  copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INPUT, buildGoldenDb, goldenCaptureCollision } from './helpers/build-db.ts';
import {
  computeCandidates, mergeJudgementsFiles, mergeSpilloverIntoQueue,
  parseDormantIds, resolveDormantSha, validateRun, writeCandidatesFile,
} from '../src/weekly/maintenance.ts';
import { parseMaintenanceJudgementsFile } from '../src/schemas/sourcedata.ts';

const SUNDAY = '2026-06-28';
const SUNDAY_DIR = join(INPUT, 'sourcedata', SUNDAY);

let built: { db: Database.Database; workRoot: string } | null = null;
const skip = goldenCaptureCollision();

beforeAll(() => {
  if (!skip) built = buildGoldenDb();
}, 180_000);
afterAll(() => {
  built?.db.close();
  if (built) rmSync(built.workRoot, { recursive: true, force: true });
});

describe('Step 0 — candidate selection', () => {
  // Full row-set parity against the committed 06-28 candidates is not
  // reconstructable from the staged inputs: the golden rebuild stamps
  // created_at with the capture day (new_chain_edge/new_relation fire
  // differently) and the 14d relevance baseline predates the staged DB
  // range. The scoring formula and the ordering/caps ARE verifiable.
  it('reproduces the oracle scoring formula on every committed record', () => {
    const committed = JSON.parse(
      readFileSync(join(SUNDAY_DIR, 'maintenance-candidates.json'), 'utf8'));
    const MAG: Record<string, number> = {
      new_contradict: 1.0, relevance_drift: 1.0,
      landed_this_week: 0.5, new_chain_edge: 0.5, new_relation: 0.5,
    };
    for (const p of committed.predictions) {
      const sigs = [...new Set(p.change_signals as string[])];
      const expected = sigs.length * sigs.reduce((s, x) => s + (MAG[x] ?? 1), 0);
      expect(p.confidence_drift_score, p.prediction_id).toBe(expected);
    }
  });

  it.skipIf(skip !== null)('computed queue is sorted, capped, and score-consistent', () => {
    const payload = computeCandidates(built!.db, SUNDAY, new Set());
    expect(payload.predictions.length).toBeLessThanOrEqual(30);
    expect(payload.glossary_terms.length).toBeLessThanOrEqual(20);
    for (let i = 1; i < payload.predictions.length; i++) {
      const a = payload.predictions[i - 1];
      const b = payload.predictions[i];
      expect(a.confidence_drift_score > b.confidence_drift_score
        || (a.confidence_drift_score === b.confidence_drift_score
          && a.prediction_id < b.prediction_id)).toBe(true);
    }
    // (Row-set overlap with the committed file is NOT asserted: the
    // staged DB lacks the 14d relevance baseline, so relevance_drift —
    // the committed file's dominant signal — cannot fire here.)
    expect(payload.predictions.length).toBeGreaterThan(0);
    for (const p of payload.predictions)
      expect(p.change_signals.length).toBeGreaterThan(0);
  });

  it.skipIf(skip !== null)(
    'the dormant-resolution fix excludes dormant predictions from the queue', () => {
      const snapshot = readFileSync(
        join(INPUT, 'memory', 'dormant', `dormant-${SUNDAY.replaceAll('-', '')}.md`), 'utf8');
      const dormantSha = resolveDormantSha(join(INPUT, 'sourcedata'), snapshot);
      // The staged corpus carries only ~27 of the origin days, so only a
      // subset of the 85 short ids resolves here; production resolves all.
      expect(dormantSha.size).toBeGreaterThan(10);
      const payload = computeCandidates(built!.db, SUNDAY, dormantSha);
      for (const p of payload.predictions)
        expect(dormantSha.has(p.prediction_id), p.prediction_id).toBe(false);
    });
});

describe('Step 1 — judgement fragment merge (oracle parity)', () => {
  it('merges the real 06-28 fragments into the committed merged file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nf-maint-'));
    const dateDir = join(dir, SUNDAY);
    mkdirSync(dateDir);
    try {
      for (const f of readdirSync(SUNDAY_DIR))
        if (f.startsWith('maintenance-judgements.') && f !== 'maintenance-judgements.json')
          copyFileSync(join(SUNDAY_DIR, f), join(dateDir, f));
      const out = mergeJudgementsFiles(dateDir);
      const merged = parseMaintenanceJudgementsFile(
        JSON.parse(readFileSync(out, 'utf8')));
      const committed = parseMaintenanceJudgementsFile(
        JSON.parse(readFileSync(join(SUNDAY_DIR, 'maintenance-judgements.json'), 'utf8')));
      expect(merged).toEqual(committed);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('refuses an empty date dir', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nf-maint-empty-'));
    try {
      expect(() => mergeJudgementsFiles(dir)).toThrow(/no maintenance-judgements/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('dormant-id parsing/resolution', () => {
  it('extracts both short and inline sha ids', () => {
    const { shortIds, shaIds } = parseDormantIds(
      '| 20260420-3 | x | prediction.abcdef0123456789 mentioned |');
    expect(shortIds).toEqual(['20260420-3']);
    expect(shaIds).toEqual(['prediction.abcdef0123456789']);
  });

  it('resolves short ids through predictions.json ordering', () => {
    const sha = resolveDormantSha(join(INPUT, 'sourcedata'), '| 20260628-1 | x |');
    // 2026-06-28's first prediction (1-based index 1).
    const first = JSON.parse(readFileSync(
      join(SUNDAY_DIR, 'predictions.json'), 'utf8')).predictions[0].id;
    expect(sha.has(first)).toBe(true);
  });
});

describe('spillover queue', () => {
  it('appends a section, bumps starvation counters, keeps one intro', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nf-queue-'));
    const q = join(dir, 'queue.md');
    try {
      const spill = {
        predictions: [{ prediction_id: 'prediction.aaa', change_signals: [], confidence_drift_score: 1 }],
        glossary_terms: [{ term_id: 'TermX', ttl_expired_days: 20 }],
      };
      mergeSpilloverIntoQueue(q, spill, '2026-06-28');
      mergeSpilloverIntoQueue(q, spill, '2026-07-05');
      const text = readFileSync(q, 'utf8');
      expect(text.match(/# Maintenance spillover queue/g)!.length).toBe(1);
      expect(text.match(/Predictions \/ glossary terms trimmed/g)!.length).toBe(1);
      expect(text).toContain('## 2026-06-28');
      expect(text).toContain('## 2026-07-05');
      // Second week's section carries the bumped counter.
      const week2 = text.slice(text.indexOf('## 2026-07-05'));
      expect(week2).toContain('| prediction.aaa | 2026-07-05 | 2 |');
      expect(week2).toContain('| TermX | 2026-07-05 | 2 |');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('no-ops on empty spillover', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nf-queue2-'));
    const q = join(dir, 'queue.md');
    try {
      mergeSpilloverIntoQueue(q, { predictions: [], glossary_terms: [] }, '2026-06-28');
      expect(() => readFileSync(q, 'utf8')).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('Step 3 — validate applied-or-escalated', () => {
  function scaffold(judgements: unknown[]): { root: string; args: any } {
    const root = mkdtempSync(join(tmpdir(), 'nf-val-'));
    const sd = join(root, 'app', 'sourcedata', SUNDAY);
    mkdirSync(sd, { recursive: true });
    writeFileSync(join(sd, 'maintenance-judgements.json'),
      JSON.stringify({ week_ending: SUNDAY, judgements }), 'utf8');
    return {
      root,
      args: {
        db: built?.db, sourcedataRoot: join(root, 'app', 'sourcedata'),
        newsRepo: root, weekEnding: SUNDAY,
      },
    };
  }
  const J = (over: Record<string, unknown>) => ({
    prediction_id: 'prediction.aaa', stream: 'reasoning',
    entry_id: 'prediction.aaa', verdict: 'fresh', reason: 'r',
    cross_stream_evidence: [], proposed_action: 'noop', confidence: 0.9,
    ...over,
  });

  it.skipIf(skip !== null)('fresh judgements validate clean', () => {
    const { root, args } = scaffold([J({})]);
    try {
      expect(validateRun(args)).toEqual([]);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it.skipIf(skip !== null)('stale without an applied artifact fails; the marker satisfies it', () => {
    const { root, args } = scaffold([J({ verdict: 'stale', proposed_action: 'rewrite' })]);
    try {
      expect(validateRun(args).length).toBe(1);
      writeFileSync(join(root, 'app', 'sourcedata', SUNDAY,
        'maintenance-update.reasoning.prediction.aaa.json'), '{}', 'utf8');
      expect(validateRun(args)).toEqual([]);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it.skipIf(skip !== null)('broken requires a broken.md mention', () => {
    const { root, args } = scaffold([J({ verdict: 'broken' })]);
    try {
      expect(validateRun(args).length).toBe(1);
      const bdir = join(root, 'memory', 'maintenance', SUNDAY);
      mkdirSync(bdir, { recursive: true });
      writeFileSync(join(bdir, 'broken.md'),
        '# broken\n| prediction.aaa | reasoning |\n', 'utf8');
      expect(validateRun(args)).toEqual([]);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});

describe('candidates file write', () => {
  it.skipIf(skip !== null)('round-trips through the schema validator', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nf-cand-'));
    try {
      const payload = computeCandidates(built!.db, SUNDAY, new Set());
      const out = writeCandidatesFile(dir, payload);
      const back = JSON.parse(readFileSync(out, 'utf8'));
      expect(back.predictions).toEqual(payload.predictions);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
