// Locale model (post-C P5): EN + an owner-configured subset of the
// ja/es/fil universe. Covers the set resolver, the replay derivation
// precedence (run.json > locale-dir listing > default), and the
// parameterized fan-outs/gates for a shrunken set and for EN-only.
import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  NON_EN_LOCALES, readmeSuffixes, replayLocaleSet, resolveLocaleSet,
} from '../src/world-paths.ts';
import { datePaths } from '../src/render/lint-markdown-clean.ts';
import {
  dailyUpdateSteps, futurePredictionSteps,
} from '../src/orchestrator/steps.ts';
import { RunManifest, type RunCtx } from '../src/orchestrator/core.ts';
import { dailyFlowCheck } from '../src/gates/daily-flow-check.ts';
import { postUpdateValidation } from '../src/gates/post-update-validation.ts';
import { runExport } from '../src/export/export.ts';
import { connect, initDb } from '../src/db/db.ts';

const TRIO = ['ja', 'es', 'fil'];

describe('resolveLocaleSet', () => {
  it('defaults to the full trio when the key is absent', () => {
    expect(resolveLocaleSet(undefined)).toEqual(TRIO);
    expect(resolveLocaleSet(null)).toEqual(TRIO);
  });

  it('accepts a subset and normalizes to universe order', () => {
    expect(resolveLocaleSet(['fil', 'ja'])).toEqual(['ja', 'fil']);
    expect(resolveLocaleSet(['es'])).toEqual(['es']);
    expect(resolveLocaleSet([])).toEqual([]);
  });

  it('dedupes', () => {
    expect(resolveLocaleSet(['es', 'es', 'es'])).toEqual(['es']);
  });

  it('throws a clear error on invalid content', () => {
    expect(() => resolveLocaleSet('ja')).toThrow(/must be an array/);
    expect(() => resolveLocaleSet({ ja: true })).toThrow(/must be an array/);
    expect(() => resolveLocaleSet(['de'])).toThrow(/unsupported locale "de"/);
    expect(() => resolveLocaleSet([42])).toThrow(/unsupported locale 42/);
    expect(() => resolveLocaleSet(['ja', 'en'])).toThrow(/unsupported locale "en"/);
  });
});

describe('replayLocaleSet precedence', () => {
  it('prefers the committed run.json locales field', () => {
    const root = mkdtempSync(join(tmpdir(), 'nf-replay-set-'));
    try {
      const d = '2026-01-04';
      mkdirSync(join(root, d), { recursive: true });
      writeFileSync(join(root, d, 'run.json'),
        JSON.stringify({ date: d, locales: ['en', 'ja'] }));
      // A staged sibling dir for a DIFFERENT locale must not win.
      mkdirSync(join(root, 'locales', d, 'es'), { recursive: true });
      expect(replayLocaleSet(root, d)).toEqual(['ja']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('falls back to the locale-dir listing for pre-model days', () => {
    const root = mkdtempSync(join(tmpdir(), 'nf-replay-set-'));
    try {
      const d = '2026-01-04';
      mkdirSync(join(root, d), { recursive: true });
      // A pre-model run.json exists but has no locales field.
      writeFileSync(join(root, d, 'run.json'), JSON.stringify({ date: d }));
      mkdirSync(join(root, 'locales', d, 'ja'), { recursive: true });
      mkdirSync(join(root, 'locales', d, 'fil'), { recursive: true });
      expect(replayLocaleSet(root, d)).toEqual(['ja', 'fil']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('falls back to the default trio when nothing is recorded or staged', () => {
    const root = mkdtempSync(join(tmpdir(), 'nf-replay-set-'));
    try {
      expect(replayLocaleSet(root, '2026-01-04')).toEqual(TRIO);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('refuses a corrupt recorded set instead of guessing', () => {
    const root = mkdtempSync(join(tmpdir(), 'nf-replay-set-'));
    try {
      const d = '2026-01-04';
      mkdirSync(join(root, d), { recursive: true });
      writeFileSync(join(root, d, 'run.json'),
        JSON.stringify({ date: d, locales: ['en', 'de'] }));
      expect(() => replayLocaleSet(root, d)).toThrow(/unsupported locale "de"/);
      writeFileSync(join(root, d, 'run.json'),
        JSON.stringify({ date: d, locales: 'ja' }));
      expect(() => replayLocaleSet(root, d)).toThrow(/not an array/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('round-trips the set a RunManifest records', () => {
    const root = mkdtempSync(join(tmpdir(), 'nf-replay-set-'));
    try {
      const d = '2026-01-04';
      const manifest = new RunManifest({
        date: d, mode: 'live', runtime: 'claude-code', search: 'native',
        synthModel: null, locales: ['en', 'ja'],
      });
      const path = manifest.write(root, d);
      expect(JSON.parse(readFileSync(path, 'utf8')).locales).toEqual(['en', 'ja']);
      expect(replayLocaleSet(root, d)).toEqual(['ja']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('set-derived fan-outs (set = [ja])', () => {
  it('readmeSuffixes derives from the set', () => {
    expect(readmeSuffixes(['ja'])).toEqual(['', '.ja']);
    expect(readmeSuffixes([])).toEqual(['']);
    expect(readmeSuffixes(NON_EN_LOCALES)).toEqual(['', '.ja', '.es', '.fil']);
  });

  it('datePaths lints only the render set even when other locale files exist', () => {
    const root = mkdtempSync(join(tmpdir(), 'nf-lint-set-'));
    try {
      const d = '2026-03-04';
      const stem = d.replaceAll('-', '');
      for (const l of ['en', 'ja', 'es']) {
        mkdirSync(join(root, 'data', 'daily-news', l), { recursive: true });
        mkdirSync(join(root, 'data', 'future-prediction', l), { recursive: true });
        writeFileSync(join(root, 'data', 'daily-news', l, `news-${stem}.md`), 'x\n');
        writeFileSync(join(root, 'data', 'future-prediction', l,
          `future-prediction-${stem}.md`), 'x\n');
      }
      const paths = datePaths(root, d, ['en', 'ja']);
      expect(paths).toHaveLength(4); // 2 kinds x {en, ja}
      expect(paths.some(p => p.includes(`${join('daily-news', 'es')}`))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('puv demands locale columns only for the configured set', () => {
    const root = mkdtempSync(join(tmpdir(), 'nf-puv-set-'));
    try {
      const d = '2026-03-04';
      const stem = d.replaceAll('-', '');
      // Locale files for en + ja only.
      for (const l of ['en', 'ja']) {
        mkdirSync(join(root, 'data', 'daily-news', l), { recursive: true });
        writeFileSync(join(root, 'data', 'daily-news', l, `news-${stem}.md`), 'x\n');
      }
      const dbFile = join(root, 'analytics.sqlite');
      initDb(dbFile);
      const db = connect(dbFile);
      // One prediction with EN + _ja columns filled, _es/_fil NULL.
      const enCols = ['title', 'reasoning_because', 'reasoning_given',
        'reasoning_so_that', 'reasoning_landing', 'plain_language', 'summary'];
      const cols = ['prediction_id', 'prediction_summary', 'prediction_date',
        'source_row_index', 'target_start_date', 'target_end_date',
        ...enCols, ...enCols.map(c => `${c}_ja`)];
      db.prepare(
        `INSERT INTO predictions (${cols.join(', ')})
         VALUES (${cols.map(() => '?').join(', ')})`)
        .run('prediction.testloc1', 'body', d, 0, '2026-04-01', '2026-06-30',
          ...enCols.map(c => `${c} en`), ...enCols.map(c => `${c} ja`));
      db.close();
      const common = {
        check: 'news' as const, date: d, db: dbFile,
        exportsDir: join(root, 'data', 'exports'), repoRoot: root,
      };
      // set=[ja]: nothing demands _es/_fil; _ja is satisfied.
      const withJa = postUpdateValidation({ ...common, locales: ['ja'] });
      expect(withJa.lines.join('\n')).not.toMatch(/_es|_fil|_ja/);
      // set=[] (EN-only): no _ja/_es/_fil demanded at all.
      const enOnly = postUpdateValidation({ ...common, locales: [] });
      expect(enOnly.lines.join('\n')).not.toMatch(/_ja|_es|_fil/);
      // Default trio: the missing _es columns (and es/fil files) fail.
      const full = postUpdateValidation({ ...common });
      expect(full.exit).toBe(1);
      expect(full.lines.join('\n')).toMatch(/_es is NULL\/empty/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('export bags and manifest emit en + the set', () => {
    const root = mkdtempSync(join(tmpdir(), 'nf-export-set-'));
    try {
      // Two DBs: graph_exports keys on hashId(scope, buildId=nowIso()),
      // so two exports from one DB inside the same second would collide.
      const dbFileJa = join(root, 'analytics-ja.sqlite');
      initDb(dbFileJa); // schema seeds categories/themes/windows
      const dbJa = connect(dbFileJa);
      runExport(dbJa, { outputDir: join(root, 'ex-ja'), publishRoot: root, locales: ['ja'] });
      dbJa.close();
      const mJa = JSON.parse(readFileSync(join(root, 'ex-ja', 'manifest.json'), 'utf8'));
      expect(mJa.locales).toEqual(['en', 'ja']);
      expect(mJa.default_locale).toBe('en');
      const gJa = JSON.parse(readFileSync(join(root, 'ex-ja', 'graph-tech.json'), 'utf8'));
      const labeled = gJa.nodes.find((n: any) => n.labels?.label);
      expect(labeled).toBeTruthy();
      expect(Object.keys(labeled.labels.label)).toEqual(['en', 'ja']);
      // EN-only: bags shrink to {en}, manifest to ['en'].
      const dbFileEn = join(root, 'analytics-en.sqlite');
      initDb(dbFileEn);
      const dbEn = connect(dbFileEn);
      runExport(dbEn, { outputDir: join(root, 'ex-en'), publishRoot: root, locales: [] });
      dbEn.close();
      const mEn = JSON.parse(readFileSync(join(root, 'ex-en', 'manifest.json'), 'utf8'));
      expect(mEn.locales).toEqual(['en']);
      const gEn = JSON.parse(readFileSync(join(root, 'ex-en', 'graph-tech.json'), 'utf8'));
      expect(Object.keys(gEn.nodes.find((n: any) => n.labels?.label).labels.label))
        .toEqual(['en']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('EN-only run behavior (set = [])', () => {
  function stubCtx(locales: readonly string[]): RunCtx {
    return {
      date: '2026-03-04',
      dow: 3,
      dataDir: '/nonexistent',
      newsRepo: '/nonexistent',
      sourcedataRoot: '/nonexistent/data/sourcedata',
      dbFile: '/nonexistent/analytics.sqlite',
      db: null as never,
      ai: null,
      runtime: 'claude-code',
      search: 'native',
      synthModel: null,
      locales,
      replay: false,
      dryRun: false,
      todayIso: '2026-03-04',
      log: () => {},
      manifest: new RunManifest({
        date: '2026-03-04', mode: 'live', runtime: 'claude-code',
        search: 'native', synthModel: null, locales: ['en', ...locales],
      }),
    };
  }

  it('translate fan-outs iterate zero times', async () => {
    const translateNews = dailyUpdateSteps().find(s => s.id === 'translate-news')!;
    const translateFp = futurePredictionSteps().find(s => s.id === 'translate-fp')!;
    // Empty set: resolves without ever reaching for the (absent) AI.
    await expect(translateNews.run(stubCtx([]))).resolves.toBeUndefined();
    await expect(translateFp.run(stubCtx([]))).resolves.toBeUndefined();
    // Contrast: a non-empty set on the same AI-less ctx fails fast.
    await expect(translateNews.run(stubCtx(['ja'])))
      .rejects.toThrow(/no AI runtime configured/);
  });

  it('daily-flow-check accepts an EN-only day and a manifest of [en]', () => {
    const root = mkdtempSync(join(tmpdir(), 'nf-flow-set-'));
    try {
      const d = '2026-03-04';
      const stem = d.replaceAll('-', '');
      mkdirSync(join(root, 'data', 'daily-news', 'en'), { recursive: true });
      mkdirSync(join(root, 'data', 'future-prediction', 'en'), { recursive: true });
      writeFileSync(join(root, 'data', 'daily-news', 'en', `news-${stem}.md`), 'x\n');
      writeFileSync(join(root, 'data', 'future-prediction', 'en',
        `future-prediction-${stem}.md`), 'x\n');
      writeFileSync(join(root, 'README.md'), [
        '## 2026-03-02', 'a',
        '## 2026-03-03', 'b',
        `## ${d}`,
        `[news-${stem}.md](data/daily-news/en/news-${stem}.md)`,
        `[future-prediction-${stem}.md](data/future-prediction/en/future-prediction-${stem}.md)`,
        '',
      ].join('\n'));
      mkdirSync(join(root, 'data', 'exports'), { recursive: true });
      writeFileSync(join(root, 'data', 'exports', 'manifest.json'),
        JSON.stringify({ locales: ['en'], default_locale: 'en' }));
      // The flow gate's default DB probe: the in-instance store.
      initDb(join(root, 'store', 'world', 'analytics.sqlite'));

      const enOnly = dailyFlowCheck({ repoRoot: root, date: d, mode: 'report-missing', locales: [] });
      const text = enOnly.lines.join('\n');
      expect(text).toContain(`OK news+FP markdown files (${d})`);
      expect(text).toContain(`OK READMEs (3-day window including ${d})`);
      expect(text).toContain('OK exports hygiene (manifest + sqlite)');
      expect(text).not.toMatch(/README\.ja|README\.es|README\.fil|_ja|_es|_fil/);
      // The DB-population bucket legitimately fails (empty DB), but for
      // locale-free reasons only.
      expect(text).not.toMatch(/locales, expected/);

      // Contrast: the default trio on the same tree demands the four.
      const full = dailyFlowCheck({ repoRoot: root, date: d, mode: 'report-missing' });
      const fullText = full.lines.join('\n');
      expect(fullText).toContain('missing: README.ja.md');
      expect(fullText).toContain('has 1 locales, expected 4');
      expect(fullText).toContain(`missing: data/daily-news/ja/news-${stem}.md`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
