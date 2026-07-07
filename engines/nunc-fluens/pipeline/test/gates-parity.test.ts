// T5 gates: flow-check / topic-coverage / post-update-validation ported
// with output parity against the captured golden gate files.
import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dailyFlowCheck } from '../src/gates/daily-flow-check.ts';
import { checkTopicCoverage } from '../src/gates/check-topic-coverage.ts';
import { postUpdateValidation } from '../src/gates/post-update-validation.ts';
import { citationCheck, classifyHost, parsePolicy } from '../src/gates/citation-check.ts';
import { runExport } from '../src/export/export.ts';
import {
  buildGoldenDb, GOLDENS, goldenCaptureCollision, INPUT, MANIFEST,
  normalizeVolatile, TODAY,
} from './helpers/build-db.ts';

const EXPECTED = join(GOLDENS, 'expected');
const days: string[] = MANIFEST.renderDays;
// Skip when the committed goldens were captured on a colliding day and
// today is a different day (see goldenCaptureCollision).
const skipReason = goldenCaptureCollision();

describe('check-topic-coverage parity', () => {
  for (const d of days) {
    it.skipIf(skipReason)(`matches the golden topic gate for ${d}`, () => {
      const gates = JSON.parse(readFileSync(join(EXPECTED, 'gates', `${d}.json`), 'utf8'));
      const r = checkTopicCoverage({ sourcedataDir: join(INPUT, 'data', 'sourcedata'), date: d });
      expect(r.exit).toBe(gates.topic);
      const golden = readFileSync(join(EXPECTED, 'gates', `${d}.topic.txt`), 'utf8');
      expect(normalizeVolatile(r.lines.join('\n') + '\n'))
        .toBe(normalizeVolatile(golden));
    });
  }
});

describe('daily-flow-check parity', () => {
  for (const d of days) {
    it.skipIf(skipReason)(`matches the golden flow report for ${d}`, () => {
      // Recreate the capture-time work state (v2 instance shape):
      // sourcedata + the quartet staged, no store DB, no READMEs.
      const workRoot = mkdtempSync(join(tmpdir(), 'nf-flow-'));
      try {
        mkdirSync(join(workRoot, 'data'), { recursive: true });
        symlinkSync(join(INPUT, 'data', 'sourcedata'), join(workRoot, 'data', 'sourcedata'));
        for (const part of ['daily-news', 'future-prediction', 'history', 'reference'])
          symlinkSync(join(INPUT, 'data', part), join(workRoot, 'data', part));
        const gates = JSON.parse(readFileSync(join(EXPECTED, 'gates', `${d}.json`), 'utf8'));
        const r = dailyFlowCheck({ repoRoot: workRoot, date: d, mode: 'report-missing' });
        expect(r.exit).toBe(gates.flow);
        const golden = readFileSync(join(EXPECTED, 'gates', `${d}.flow.txt`), 'utf8');
        const got = (r.lines.join('\n') + '\n').replaceAll(workRoot, '<WORK>');
        expect(normalizeVolatile(got)).toBe(normalizeVolatile(golden));
      } finally {
        rmSync(workRoot, { recursive: true, force: true });
      }
    });
  }
});

describe('post-update-validation parity on the built DB', () => {
  it.skipIf(skipReason)('reproduces the golden puv exits for the Sunday', { timeout: 180_000 }, () => {
    const { db, workRoot } = buildGoldenDb();
    try {
      const outDir = join(workRoot, 'data', 'exports');
      runExport(db, { outputDir: outDir, publishRoot: workRoot });
      db.close();
      const goldenPuv = JSON.parse(
        readFileSync(join(EXPECTED, 'gates', 'post-update-validation.json'), 'utf8'));
      const sun: string = MANIFEST.sundayDay;
      const common = {
        date: sun,
        db: join(workRoot, 'analytics.sqlite'),
        exportsDir: outDir,
        repoRoot: workRoot,
      };
      expect(postUpdateValidation({ ...common, check: 'news' }).exit)
        .toBe(goldenPuv[`news-${sun}`]);
      expect(postUpdateValidation({ ...common, check: 'future-prediction' }).exit)
        .toBe(goldenPuv[`fp-${sun}`]);
      expect(postUpdateValidation({ ...common, check: 'exports' }).exit)
        .toBe(goldenPuv[`exports-${sun}`]);
    } finally {
      rmSync(workRoot, { recursive: true, force: true });
    }
  });
});

describe('citation-restriction-check', () => {
  const policyFile = join(INPUT, 'data', 'reference', 'citation-restrictions.md');

  it('parses the real policy and classifies hosts', () => {
    const policy = parsePolicy(policyFile);
    expect(policy.denylist.size
      + policy.unconfirmed_denylist.size
      + policy.parent_groups.length).toBeGreaterThan(0);
    expect(classifyHost('definitely-not-a-real-host.example', policy)).toBe('unclassified');
    if (policy.denylist.size) {
      const denied = [...policy.denylist][0];
      expect(classifyHost(denied, policy)).toBe('denylist');
      expect(classifyHost(`sub.${denied}`, policy)).not.toBe('denylist');
    }
  });

  it('passes the committed EN news drafts (no-op on clean data)', () => {
    for (const d of days) {
      const draft = join(INPUT, 'data', 'daily-news', 'en', `news-${d.replaceAll('-', '')}.md`);
      const r = citationCheck({ draft, policyFile, todayIso: TODAY });
      expect(r.exit, `${d}: ${r.lines.join('\n')}`).toBe(0);
    }
  });

  it('flags a denylisted citation and upserts the ledger', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nf-cite-'));
    try {
      const policy = join(dir, 'policy.md');
      writeFileSync(policy, [
        '## denylist', '| host | reason |', '|---|---|', '| badnews.example | tos |',
        '## parent_groups', '### BigCorp', '- corp.example', '',
      ].join('\n'));
      const draft = join(dir, 'news-20260701.md');
      writeFileSync(draft, [
        'A [bad](https://badnews.example/a) citation.',
        'A [sub](https://media.corp.example/b) one.',
        'A [fine](https://ok.example/c) one.',
      ].join('\n'));
      const ledger = join(dir, 'ledger.md');
      const r = citationCheck({ draft, policyFile: policy, unclassifiedOut: ledger, todayIso: TODAY });
      expect(r.exit).toBe(1);
      const out = r.lines.join('\n');
      expect(out).toContain('RESTRICT badnews.example');
      expect(out).toContain('RESTRICT(parent=BigCorp) media.corp.example');
      expect(out).toContain('- ok.example');
      const ledgerText = readFileSync(ledger, 'utf8');
      expect(ledgerText).toContain('| ok.example | 1 | 2026-07-01 | 2026-07-01 | fine |');
      // Second run increments the count.
      citationCheck({ draft, policyFile: policy, unclassifiedOut: ledger, todayIso: TODAY });
      expect(readFileSync(ledger, 'utf8')).toContain('| ok.example | 2 |');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
