// T4a gate: byte-identical renders against the Python-oracle goldens,
// and gate-exit parity for lint + post-write-integrity.
import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderNewsDay } from '../src/render/render-news-md.ts';
import { renderFpDay } from '../src/render/render-future-prediction-md.ts';
import { lintPaths, scanText } from '../src/render/lint-markdown-clean.ts';
import { postWriteIntegrity } from '../src/render/post-write-integrity.ts';

const GOLDENS = join(import.meta.dirname, '..', 'goldens');
const SD = join(GOLDENS, 'input', 'sourcedata');
const EXPECTED = join(GOLDENS, 'expected');
const M = JSON.parse(readFileSync(join(GOLDENS, 'fixture-manifest.json'), 'utf8'));

const days: string[] = M.renderDays;
const locales: string[] = M.locales;

describe('render byte-parity vs the python oracle', () => {
  for (const d of days) for (const L of locales) {
    it(`news ${d} ${L}`, () => {
      const expected = readFileSync(join(EXPECTED, 'render', `news-${d}.${L}.md`), 'utf8');
      expect(renderNewsDay(SD, d, L)).toBe(expected);
    });
    it(`future-prediction ${d} ${L}`, () => {
      const expected = readFileSync(join(EXPECTED, 'render', `future-prediction-${d}.${L}.md`), 'utf8');
      expect(renderFpDay(SD, d, L)).toBe(expected);
    });
  }
});

describe('gate parity on the golden renders', () => {
  for (const d of days) {
    const gates = JSON.parse(readFileSync(join(EXPECTED, 'gates', `${d}.json`), 'utf8'));
    it(`lint + integrity exits for ${d}`, () => {
      const newsFiles = locales.map(L => join(EXPECTED, 'render', `news-${d}.${L}.md`));
      const fpFiles = locales.map(L => join(EXPECTED, 'render', `future-prediction-${d}.${L}.md`));
      expect(lintPaths([...newsFiles, ...fpFiles]).exit).toBe(gates.lint);
      expect(postWriteIntegrity('news', newsFiles).exit).toBe(gates.pwiNews);
      expect(postWriteIntegrity('future-prediction', fpFiles).exit).toBe(gates.pwiFp);
    });
  }
});

describe('lint catches each forbidden token class', () => {
  const bad: Array<[string, string]> = [
    ['plain_language', 'the plain_language field leaked'],
    ['Pred ID #N', 'as seen in Pred ID #3 yesterday'],
    ['prediction.<hash>', 'see prediction.adb89416691d7587 for details'],
    ['**Summary:** parser anchor', 'text **Summary:** more'],
    ['Coherence N/5', 'scored Coherence 4/5 overall'],
    ['- because: bullet key', 'intro\n  - because: reasons'],
    ['(Tech)/(Business)/(Mix) scope prefix', 'Title (Tech) suffix'],
    ['（技術）/（ビジネス）scope prefix', '見出し（技術）続き'],
    ['day-N storyline numbering', 'the day-25 scan continues'],
    ['aging vocabulary', 'a doubly aged storyline'],
  ];
  for (const [label, text] of bad) {
    it(`flags ${label}`, () => {
      expect(scanText(text).map(h => h.label)).toContain(label);
    });
  }
  it('leaves legitimate prose alone', () => {
    expect(scanText('## Bridge\n\nEarth Day 2026 and Day 3 of the event; third consecutive beat.\n')).toEqual([]);
  });
});

describe('post-write-integrity NUL repair', () => {
  it('strips a NUL tail once and reports REPAIRED', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nf-pwi-'));
    try {
      const f = join(dir, 'x.md');
      const good = '# News Report 2026-07-04\n\n## Headlines\n\n## Future\n\n'
        + '1. a\n2. b\n3. c\n\n## Change Log\n\n## News\n';
      writeFileSync(f, good + '\x00\x00');
      const r = postWriteIntegrity('news', [f]);
      expect(r.lines[0]).toMatch(/^REPAIRED .*stripped 2 trailing NUL byte\(s\)$/);
      expect(readFileSync(f, 'utf8')).toBe(good);
      expect(r.exit).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails a file missing required sections', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nf-pwi-'));
    try {
      const f = join(dir, 'bad.md');
      writeFileSync(f, '# nothing here\n');
      const r = postWriteIntegrity('news', [f]);
      expect(r.exit).toBe(1);
      expect(r.lines.join('\n')).toContain("missing H2 section: '## Headlines'");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
