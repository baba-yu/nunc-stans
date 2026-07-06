// 4_weekly_memory live-path logic: snapshot parse/format round-trip on
// the real corpus, interval decoding, and every transition branch the
// oracle documented in the dormant-20260705.md preamble.
import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INPUT } from './helpers/build-db.ts';
import {
  addDays, advanceInterval, computeTransitions, daysDiff, DormantRow,
  formatDormantSnapshot, hitsFor, intervalOf, parseDormantSnapshot, relStamp,
  sortRows,
} from '../src/weekly/dormant.ts';
import { postWriteIntegrity } from '../src/render/post-write-integrity.ts';

const SNAP_0628 = join(INPUT, 'memory', 'dormant', 'dormant-20260628.md');
const SNAP_0705 = join(INPUT, 'memory', 'dormant', 'dormant-20260705.md');

function row(over: Partial<DormantRow> & { id: string }): DormantRow {
  return {
    short: 'a short text', signals: 'x, y, z', firstSeen: '2026-06-01',
    lastRelevance: '2 (6/14)', nextPing: '2026-07-12', daysQuiet: 14,
    ...over,
  };
}

describe('snapshot parse / format', () => {
  it('parses the real 06-28 corpus snapshot (85 rows)', () => {
    const rows = parseDormantSnapshot(readFileSync(SNAP_0628, 'utf8'));
    expect(rows.length).toBe(85);
    const r = rows.find(x => x.id === '20260421-1')!;
    expect(r.firstSeen).toBe('2026-04-21');
    expect(r.lastRelevance).toBe('3 (5/17)');
    expect(r.nextPing).toBe('2026-07-30');
    expect(r.daysQuiet).toBe(42);
  });

  it('round-trips through format and passes dormant integrity', () => {
    const rows = parseDormantSnapshot(readFileSync(SNAP_0705, 'utf8'));
    expect(rows.length).toBe(95);
    const text = formatDormantSnapshot({
      today: '2026-07-05',
      preamble: ['Mode: round-trip test.'],
      rows,
    });
    expect(parseDormantSnapshot(text)).toEqual(sortRows(rows));
    const dir = mkdtempSync(join(tmpdir(), 'nf-dormant-'));
    try {
      const p = join(dir, 'dormant-20260705.md');
      writeFileSync(p, text, 'utf8');
      const r = postWriteIntegrity('dormant', [p]);
      expect(r.exit).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('interval decoding (next-ping weekday)', () => {
  it('decodes the corpus cadence: Sun→14, Tue→30, Thu→60', () => {
    expect(intervalOf('2026-07-19')).toBe(14); // 07-05 + 14
    expect(intervalOf('2026-08-04')).toBe(30); // 07-05 + 30
    expect(intervalOf('2026-09-03')).toBe(60); // 07-05 + 60
    expect(intervalOf('2026-07-30')).toBe(60); // 05-31 + 60
    expect(intervalOf('2026-07-14')).toBe(30); // 06-14 + 30
  });

  it('advances 14→30→60 and caps at 60', () => {
    expect(advanceInterval(14)).toBe(30);
    expect(advanceInterval(30)).toBe(60);
    expect(advanceInterval(60)).toBe(60);
  });
});

describe('tier transitions (the 0705-documented branches)', () => {
  const today = '2026-07-05';

  it('exit: pool row with max_rel ≥ 4 leaves the pool', () => {
    const t = computeTransitions({
      today,
      prevRows: [row({ id: '20260430-2' })],
      poolHits: new Map([['20260430-2',
        { maxRel: 4, latestDate: '2026-06-30', latestRel: 4 }]]),
      agedOut: [],
    });
    expect(t.exits).toEqual(['20260430-2']);
    expect(t.rows).toEqual([]);
  });

  it('re-anchor only: matched < 4, not due', () => {
    const t = computeTransitions({
      today,
      prevRows: [row({ id: '20260618-1', nextPing: '2026-07-12', daysQuiet: 17 })],
      poolHits: new Map([['20260618-1',
        { maxRel: 3, latestDate: '2026-07-04', latestRel: 3 }]]),
      agedOut: [],
    });
    const r = t.rows[0];
    expect(t.reAnchored).toEqual(['20260618-1']);
    expect(t.advanced).toEqual([]);
    expect(r.lastRelevance).toBe('3 (7/04)');
    expect(r.daysQuiet).toBe(1);
    expect(r.nextPing).toBe('2026-07-12'); // unchanged
  });

  it('re-anchor + advance: matched < 4 AND due (14→30)', () => {
    const t = computeTransitions({
      today,
      prevRows: [row({ id: '20260613-3', nextPing: '2026-07-05', daysQuiet: 20 })],
      poolHits: new Map([['20260613-3',
        { maxRel: 2, latestDate: '2026-06-29', latestRel: 2 }]]),
      agedOut: [],
    });
    const r = t.rows[0];
    expect(t.advanced).toEqual(['20260613-3']);
    expect(r.lastRelevance).toBe('2 (6/29)');
    expect(r.daysQuiet).toBe(6);
    expect(r.nextPing).toBe('2026-08-04'); // today + 30
  });

  it('quiet + due: interval advances one step, Days quiet += 7', () => {
    const t = computeTransitions({
      today,
      prevRows: [
        row({ id: '20260608-1', nextPing: '2026-07-05', daysQuiet: 20 }),
        // 30d row due since 06-30 → advances to 60.
        row({ id: '20260511-2', nextPing: '2026-06-30', daysQuiet: 22 }),
      ],
      poolHits: new Map(),
      agedOut: [],
    });
    expect(t.rows[1].nextPing).toBe('2026-08-04'); // 14 → 30 (sorted: 0608 second)
    expect(t.rows[1].daysQuiet).toBe(27);
    expect(t.rows[0].nextPing).toBe('2026-09-03'); // 30 → 60
    expect(t.rows[0].daysQuiet).toBe(29);
  });

  it('quiet + not due: only Days quiet advances', () => {
    const t = computeTransitions({
      today,
      prevRows: [row({ id: '20260421-1', nextPing: '2026-07-30', daysQuiet: 42 })],
      poolHits: new Map(),
      agedOut: [],
    });
    const r = t.rows[0];
    expect(r.daysQuiet).toBe(49);
    expect(r.nextPing).toBe('2026-07-30');
    expect(r.lastRelevance).toBe('2 (6/14)'); // frozen
  });

  it('force-dormant entrants: quiet → n/a + days-since-origin; matched → stamped', () => {
    const t = computeTransitions({
      today,
      prevRows: [],
      poolHits: new Map(),
      agedOut: [
        { id: '20260622-1', short: 'captive humanoid fleets', hits: undefined },
        { id: '20260625-1', short: 'fourth buyer-designed chip',
          hits: { maxRel: 3, latestDate: '2026-07-05', latestRel: 3 } },
        { id: '20260623-1', short: 'single-node under 256GB',
          hits: { maxRel: 4, latestDate: '2026-06-30', latestRel: 4 } },
      ],
    });
    expect(t.entrants).toEqual(['20260622-1', '20260625-1']);
    expect(t.hotSkipped).toEqual(['20260623-1']);
    const quiet = t.rows.find(r => r.id === '20260622-1')!;
    expect(quiet.lastRelevance).toBe('n/a');
    expect(quiet.daysQuiet).toBe(13);
    expect(quiet.nextPing).toBe('2026-07-19'); // today + 14
    expect(quiet.firstSeen).toBe('2026-06-22');
    const hit = t.rows.find(r => r.id === '20260625-1')!;
    expect(hit.lastRelevance).toBe('3 (7/05)');
    expect(hit.daysQuiet).toBe(0);
  });

  it('a pool row is never double-entered from the aged-out slice', () => {
    const t = computeTransitions({
      today,
      prevRows: [row({ id: '20260628-2', nextPing: '2026-07-12' })],
      poolHits: new Map(),
      agedOut: [{ id: '20260628-2', short: 'already pooled', hits: undefined }],
    });
    expect(t.rows.length).toBe(1);
    expect(t.entrants).toEqual([]);
  });
});

describe('validation matching fallback', () => {
  it('falls back to prediction_date + summary LCS when no hash resolves', () => {
    const windowRows = [
      { validation_date: '2026-07-02', prediction_id: null,
        prediction_date: '2026-06-05',
        prediction_summary: 'agent-framework SQL read-only-by-default execution guards',
        observed_relevance: 3 },
      { validation_date: '2026-07-01', prediction_id: null,
        prediction_date: '2026-06-06', // wrong origin — must not match
        prediction_summary: 'agent-framework SQL read-only-by-default execution guards',
        observed_relevance: 5 },
    ];
    const hits = hitsFor({
      windowRows, sourcedataRoot: '/nonexistent',
      dormantId: '20260605-1',
      shortText: 'agent-framework SQL read-only-by-default execution guards',
    });
    expect(hits).toEqual({ maxRel: 3, latestDate: '2026-07-02', latestRel: 3 });
  });
});

describe('small helpers', () => {
  it('relStamp / addDays / daysDiff', () => {
    expect(relStamp(3, '2026-07-05')).toBe('3 (7/05)');
    expect(relStamp(4, '2026-05-04')).toBe('4 (5/04)');
    expect(addDays('2026-07-05', 14)).toBe('2026-07-19');
    expect(daysDiff('2026-06-22', '2026-07-05')).toBe(13);
  });
});
