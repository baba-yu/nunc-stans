#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-explicit-any */
// Synthetic fixture corpus (Phase C T12). Replaces the real-content
// golden corpus: the redistributable repo must not carry one user's
// editorial data. Generates a tiny, schema-shaped, self-consistent
// micro-world (fake vendors, example.com citations) under input/, then
// FREEZES the TS pipeline's own outputs under expected/ — from T12 on
// the suite is self-regression (the oracle-parity job ended when the
// Python was retired; parity evidence lives in git history and
// design/verification/phase-c.md).
//
//   node synthesize.ts inputs   — write input/ + fixture-manifest.json
//   node synthesize.ts freeze   — render/build/export via the TS
//                                 pipeline and write expected/
//   node synthesize.ts all      — both
//
// R7 (post-C REDO): input/ is INSTANCE-SHAPED — the fixture instance is
// born through the REAL `nunc-fluens init` routine (init is thereby
// exercised on every regen) in a temp dir, the synthetic data is laid
// on top, and the tree minus store/ is copied here (instances are
// git-less, R9; the init date is pinned to the fixture Sunday so
// instance.json stays byte-stable). The editorial reference seeds come
// FROM pipeline/instance-template/.
import {
  cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
import { initInstance, instanceTemplateDir } from '../src/instance.ts';

const HERE = dirname(new URL(import.meta.url).pathname);
const INPUT = join(HERE, 'input');
const EXPECTED = join(HERE, 'expected');

// Micro-world calendar: Fri, Sat, Sun (the Sunday exercises the weekly
// chain) + the previous Sunday for the dormant lineage.
export const DAYS = ['2026-01-02', '2026-01-03', '2026-01-04'];
export const SUNDAY = '2026-01-04';
export const PREV_SUNDAY = '2025-12-28';
const LOCALES = ['ja', 'es', 'fil'];

// fixture-manifest.json is the TEST-side contract (build-db.ts drives
// TODAY/dbRange from it, render-parity its day list): `inputs` emits it
// from the SAME constants that drive the corpus, so a regen that moves
// the calendar can never desync the two. The prose fields are fixed
// strings — the emitted file is byte-stable while the constants hold.
const MANIFEST_WHY = 'T12: the real-content golden corpus validated the TS port '
  + 'against the Python oracle and was dropped with it — the redistributable '
  + 'repo carries no personal editorial data. From here the suite is TS '
  + "self-regression: expected/ is frozen from the pipeline's own output over "
  + 'this schema-shaped micro-world. The oracle-parity record lives in git '
  + 'history and design/verification/phase-c.md.';
const MANIFEST_NORM_ISO = 'every timestamp in the DB dump is rewritten to the '
  + 'epoch before comparing (CURRENT_TIMESTAMP metadata); with todayIso pinned '
  + 'to the fixture Sunday there is no capture-day token — the corpus is fully '
  + 'deterministic';
const MANIFEST_NORM_NUM = 'export JSON comparisons stay parsed-value based '
  + '(formatting-neutral)';

function writeManifest(): void {
  const j = (s: string) => JSON.stringify(s);
  const jarr = (xs: readonly string[]) => `[${xs.map(j).join(', ')}]`;
  w(join(HERE, 'fixture-manifest.json'), [
    '{',
    '  "synthetic": true,',
    '  "generator": "goldens/synthesize.ts (node synthesize.ts all)",',
    `  "why": ${j(MANIFEST_WHY)},`,
    `  "renderDays": ${jarr(DAYS)},`,
    `  "sundayDay": ${j(SUNDAY)},`,
    `  "prevSunday": ${j(PREV_SUNDAY)},`,
    `  "dbRange": { "start": ${j(DAYS[0])}, "end": ${j(DAYS[DAYS.length - 1])} },`,
    `  "todayIso": ${j(SUNDAY)},`,
    `  "locales": ${jarr(['en', ...LOCALES])},`,
    '  "normalization": {',
    `    "isoTimestamps": ${j(MANIFEST_NORM_ISO)},`,
    `    "jsonNumberFormatting": ${j(MANIFEST_NORM_NUM)}`,
    '  }',
    '}',
  ].join('\n') + '\n');
}

function stem(d: string): string { return d.replaceAll('-', ''); }

function w(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf8');
}

function wj(path: string, obj: unknown): void {
  w(path, JSON.stringify(obj, null, 2) + '\n');
}

// Deterministic fake sha16 per (day, index).
function sha(seed: string): string {
  let h = 0n;
  for (const c of seed) h = (h * 131n + BigInt(c.charCodeAt(0))) % (1n << 64n);
  return h.toString(16).padStart(16, '0');
}

const VENDORS = ['Widgetly', 'Acme Metrics', 'Exampletron'];

function predId(day: string, i: number): string {
  return `prediction.${sha(`${day}-${i}`)}`;
}

function prediction(day: string, i: number) {
  const vendor = VENDORS[i % VENDORS.length];
  return {
    id: predId(day, i),
    scope_hint: i % 2 ? 'business' : 'tech',
    title: `${vendor} ships synthetic milestone ${stem(day)}-${i} by Q3 2026`,
    body: `${vendor} announced a synthetic milestone on ${day}. This fixture `
      + 'prediction exists to exercise the pipeline shape: it claims the '
      + `vendor lands milestone ${i} within two quarters, citing the fixture `
      + 'announcement. No real product, vendor, or person is referenced.',
    reasoning: {
      because: `fixture announcement observed on ${day}`,
      given: 'the synthetic market always follows its announcements',
      so_that: `${vendor} lands milestone ${i} within two quarters`,
      landing: 'Q3 2026, fixture scope',
      plain_language: `${vendor} will finish milestone ${i} soon.`,
    },
    summary: `${vendor} is expected to land synthetic milestone ${i}. `
      + 'This is fixture prose used only by the test suite.',
  };
}

function loc(s: string, L: string): string {
  return `[${L}] ${s}`;
}

function localizePrediction(p: any, L: string) {
  return {
    ...p,
    title: loc(p.title, L),
    body: loc(p.body, L),
    reasoning: Object.fromEntries(
      Object.entries(p.reasoning).map(([k, v]) => [k, loc(v as string, L)])),
    summary: loc(p.summary, L),
  };
}

const CITE = (day: string, i: number) => ({
  label: `Example ${i} (${day})`,
  url: `https://example.com/${stem(day)}/${i}`,
});

function newsSection(day: string) {
  return {
    date: day,
    sections: [{
      category: 'Synthetic fixtures',
      bullets: [0, 1].map(i => ({
        body: `${VENDORS[i]} published fixture update ${stem(day)}-${i}, `
          + 'a schema-shaped stand-in for a news bullet.',
        citations: [CITE(day, i)],
      })),
    }, {
      category: 'Bay Area / SV AI meet-up events',
      bullets: [{
        body: `Fixture Meetup ${stem(day)} is scheduled for 2026-03-01 at `
          + 'Example Hall (synthetic, always upcoming).',
        citations: [CITE(day, 9)],
      }],
    }],
  };
}

function headlines(day: string) {
  const five = [0, 1, 2, 3, 4];
  return {
    date: day,
    technical: five.map(i => ({
      lead: `Fixture lead ${stem(day)}-${i}`,
      body: `Technical fixture body ${i} for ${day}, citation-backed.`,
      citations: [CITE(day, i)],
    })),
    plain: five.map(i => `Plain fixture headline ${i} for ${day}`),
  };
}

function changeLog(day: string, prev: string | null) {
  return {
    date: day,
    vs_date: prev ?? day,
    items: [{
      kind: prev ? 'updated' : 'new',
      headline: `Fixture update ${stem(day)}-0`,
      diff_narrative: prev
        ? `Compared to ${prev}, the fixture advanced one synthetic step.`
        : 'First appearance of the fixture storyline.',
    }],
  };
}

function needs(day: string) {
  // Every prediction of the day gets a complete-5W1H need (the puv gate
  // requires each prediction to carry at least one need row).
  const by_prediction: Record<string, unknown[]> = {};
  for (let i = 0; i < 3; i++) {
    by_prediction[predId(day, i)] = [{
      actor: `synthetic vendor ${i}`,
      job: 'ship the fixture milestone',
      outcome: 'fixture milestone generally available',
      motivation: 'keep the synthetic market believing announcements',
      task: {
        who: 'the fixture vendor team',
        what: `publish milestone artifact ${i}`,
        where: 'example.com',
        when: 'before Q3 2026',
        why: 'the announcement said so',
        how: 'run the fixture release process',
      },
    }];
  }
  return { date: day, by_prediction };
}

function bridges(day: string, priorDays: string[]) {
  const rows = priorDays.flatMap(d => [0, 1, 2].map(i => ({
    prediction_ref: {
      id: predId(d, i),
      short_label: `${VENDORS[i % VENDORS.length]} ships synthetic milestone ${stem(d)}-${i} by Q3 2026`,
      prediction_date: d,
    },
    today_relevance: ((i + priorDays.length + Number(stem(day))) % 5) + 1 <= 3
      ? ((i + priorDays.length) % 3) + 1 : 3,
    evidence_summary: `Today's fixture update ${stem(day)}-${i % 2} touches the `
      + 'same synthetic storyline.',
    reference_links: [CITE(day, i % 2)],
    bridge: {
      support_dimension: (['because', 'given', 'so_that', 'landing', 'none'] as const)[i % 5],
      // Kept clear of the lint-markdown-clean forbidden tokens (no
      // "Coherence N/5", no parser anchors) — synthetic renders must
      // pass the same gates as real ones.
      narrative: `Today's fixture update supports the synthetic milestone `
        + `from ${d}. The vendor has not shipped yet, so the remaining gap `
        + 'is the milestone artifact itself.',
      coherence: 3,
      remaining_gap: 'milestone not yet shipped',
    },
  })));
  return { date: day, validation_rows: rows };
}

function readings(day: string) {
  return { date: day, chain_edges: [], relations: [], cluster_pointers: [] };
}

function summary(day: string) {
  return {
    plain_language: `Fixture summary for ${day}: the synthetic storyline advanced.`,
    findings: ['the fixture market keeps its promises'],
    relation_to_my_preds: 'all fixture predictions remain on track',
  };
}

// The topic taxonomy the check-topic-coverage gate enumerates (real
// product topics, hardcoded in the gate). The synthetic corpus reports
// every one honestly as uncovered/consistent, except the always-present
// events bullet — so the gate passes (incl. the mandatory Unsloth row).
const GATE_TOPICS = [
  'LLM Workflow', 'Multi-profiling for Local LLM (e.g. Multica)',
  'Agent Harness (OpenClaw, NemoClaw, Hermes Agents, etc.)',
  'Platform for Local LLM (vLLM, SGLang, etc.)',
  'Ecosystems for Local LLM Embedded System (Foundry Local, etc.)',
  'Local LLM Models', 'Local LLM Optimization, Fine-tuning (Unsloth — every run)',
  'Ecosystems for LLM on PaaS (AWS Bedrock, Azure AI Foundry, etc.)',
  'AI Security', 'CVE update on score ≥ 8.0', 'Hardware', 'Physical AI',
  'LLM-related research and papers', 'Stock prices and corporate activity',
  'Bay Area / SV AI meet-up events', 'Other standing-out topics',
];

function verification(day: string) {
  return {
    date: day,
    verifications: GATE_TOPICS.map(topic => topic === 'Bay Area / SV AI meet-up events'
      ? {
          topic, semantic_verdict: 'covered', matching_bullets: [0],
          search_log_alignment: 'consistent',
          reason: 'The events bullet carries the always-upcoming fixture meetup.',
        }
      : {
          topic, semantic_verdict: 'uncovered', matching_bullets: [],
          search_log_alignment: 'consistent',
          reason: `No fixture bullet anchors '${topic}' on ${day}.`,
        }),
  };
}

// --- inputs -----------------------------------------------------------------

export function writeInputs(): void {
  rmSync(INPUT, { recursive: true, force: true });

  // The editorial reference seeds come FROM the template (they double
  // as the fixture's policy files) — assert presence, never generate.
  const template = instanceTemplateDir();
  for (const f of ['news-topics.md', 'citation-restrictions.md', 'glossary.yml'])
    if (!existsSync(join(template, 'data', 'reference', f)))
      throw new Error(`instance template missing data/reference/${f} — `
        + 'the goldens inherit the template seeds');

  // Born through the REAL init routine, in a TEMP dir: store/ is
  // runtime state and is filtered out of the final copy. The created
  // date is pinned to the fixture Sunday (= the corpus todayIso) so
  // instance.json is deterministic.
  const tmpRoot = mkdtempSync(join(tmpdir(), 'nf-goldens-init-'));
  const inst = join(tmpRoot, 'instance');
  try {
    initInstance(inst, SUNDAY);

    // Pre-seed the citation ledger with EVERY citation URL the corpus
    // uses (news_section 0/1/9, headlines 0-4, bridges 0/1) so the
    // daily append-references step is a no-op on replay.
    const citeIdx = [0, 1, 2, 3, 4, 9];
    w(join(inst, 'data', 'history', 'reference-history.log'),
      DAYS.flatMap(d => citeIdx.map(i => `https://example.com/${stem(d)}/${i}`))
        .join('\n') + '\n');

    // sourcedata per day (+ locales)
    DAYS.forEach((day, di) => {
      const dir = join(inst, 'data', 'sourcedata', day);
      const prev = di > 0 ? DAYS[di - 1] : null;
      const priorDays = DAYS.slice(0, di + 1); // last-7d window inside the micro-world
      wj(join(dir, 'news_section.json'), newsSection(day));
      wj(join(dir, 'predictions.json'),
        { date: day, predictions: [0, 1, 2].map(i => prediction(day, i)) });
      wj(join(dir, 'headlines.json'), headlines(day));
      wj(join(dir, 'change_log.json'), changeLog(day, prev));
      wj(join(dir, 'needs.json'), needs(day));
      wj(join(dir, 'bridges.json'), bridges(day, priorDays));
      wj(join(dir, 'readings.json'), readings(day));
      wj(join(dir, 'summary.json'), summary(day));
      wj(join(dir, 'verification.json'), verification(day));
      for (const L of LOCALES) {
        const ldir = join(inst, 'data', 'sourcedata', 'locales', day, L);
        wj(join(ldir, 'news_section.json'), {
          ...newsSection(day),
          sections: newsSection(day).sections.map(s => ({
            ...s,
            bullets: s.bullets.map(b => ({ ...b, body: loc(b.body, L) })),
          })),
        });
        wj(join(ldir, 'predictions.json'), {
          date: day,
          predictions: [0, 1, 2].map(i => localizePrediction(prediction(day, i), L)),
        });
        wj(join(ldir, 'headlines.json'), {
          ...headlines(day),
          technical: headlines(day).technical.map(t => ({ ...t, body: loc(t.body, L) })),
          plain: headlines(day).plain.map(p => loc(p, L)),
        });
        wj(join(ldir, 'change_log.json'), {
          ...changeLog(day, prev),
          items: changeLog(day, prev).items.map(it => ({
            ...it, diff_narrative: loc(it.diff_narrative, L),
          })),
        });
        wj(join(ldir, 'needs.json'), needs(day));
        wj(join(ldir, 'bridges.json'), {
          ...bridges(day, priorDays),
          validation_rows: bridges(day, priorDays).validation_rows.map(r => ({
            ...r,
            evidence_summary: loc(r.evidence_summary, L),
            bridge: { ...r.bridge, narrative: loc(r.bridge.narrative, L) },
          })),
        });
        wj(join(ldir, 'summary.json'), {
          ...summary(day), plain_language: loc(summary(day).plain_language, L),
        });
      }
    });

    // history/: dormant lineage + theme review + maintenance (Sunday)
    const dormantHeader = (d: string, rows: string[]) => [
      `# Dormant pool — week ending ${d}`, '',
      'Mode: synthetic fixture rotation.', '',
      '## Tier: Dormant — interval ≥ 14 days', '',
      '| ID | Prediction (short) | Signals | First seen | Last relevance | Next ping | Days quiet |',
      '|---|---|---|---|---|---|---|',
      ...rows, '',
    ].join('\n');
    w(join(inst, 'data', 'history', 'dormant', `dormant-${stem(PREV_SUNDAY)}.md`),
      dormantHeader(PREV_SUNDAY, [
        `| 20251215-1 | Widgetly ships synthetic milestone 20251215-1 by Q3 2026 | widget, fixture, synthetic milestone | 2025-12-15 | 2 (12/20) | ${PREV_SUNDAY} | 8 |`,
      ]));
    w(join(inst, 'data', 'history', 'dormant', `dormant-${stem(SUNDAY)}.md`),
      dormantHeader(SUNDAY, [
        `| 20251215-1 | Widgetly ships synthetic milestone 20251215-1 by Q3 2026 | widget, fixture, synthetic milestone | 2025-12-15 | 2 (12/20) | 2026-02-03 | 15 |`,
        // An in-corpus entry (2026-01-02 is a fixture day) so the export
        // layer's dormant styling is actually exercised: loadDormantSet
        // keys `${date}||${N}` against source_row_index, so one exported
        // prediction node must carry `dormant: true` in the frozen graphs
        // (post-C T6 guard for the silently-empty-set failure mode).
        `| 20260102-1 | Acme Metrics ships synthetic milestone 20260102-1 by Q3 2026 | acme, fixture, metrics | 2026-01-02 | 1 (1/02) | 2026-01-18 | 2 |`,
      ]));
    w(join(inst, 'data', 'history', 'theme-review', `theme-review-${stem(SUNDAY)}.md`), [
      `# Theme review — week ending ${SUNDAY}`, '',
      'Mode: synthetic fixture rotation.', '',
      '## Empty / underused themes', '',
      'None — the fixture taxonomy is tiny by design.', '',
      '## Overpopulated themes', '',
      'None.', '',
      '## Theme candidates', '',
      'No candidate reaches the promotion bar in the fixture corpus.', '',
      '## Recommended actions', '',
      '### Action 1: Observation (no schema edit)', '',
      'Log-only fixture action; out of scope for this proposal.', '',
      '```action',
      '{"kind": "log-only"}',
      '```', '',
    ].join('\n'));
    const sd = join(inst, 'data', 'sourcedata', SUNDAY);
    wj(join(sd, 'maintenance-candidates.json'), {
      week_ending: SUNDAY,
      predictions: [{
        prediction_id: predId(DAYS[0], 0),
        change_signals: ['relevance_drift'],
        confidence_drift_score: 1,
      }],
      glossary_terms: [],
    });
    wj(join(sd, `maintenance-judgements.${predId(DAYS[0], 0)}.json`), {
      prediction_id: predId(DAYS[0], 0),
      judgements: [{
        prediction_id: predId(DAYS[0], 0),
        stream: 'reasoning',
        entry_id: predId(DAYS[0], 0),
        verdict: 'fresh',
        reason: 'the fixture storyline is unchanged',
        cross_stream_evidence: [],
        proposed_action: 'noop',
        confidence: 0.9,
      }],
    });
    wj(join(sd, 'maintenance-judgements.json'), {
      week_ending: SUNDAY,
      judgements: [{
        prediction_id: predId(DAYS[0], 0),
        stream: 'reasoning',
        entry_id: predId(DAYS[0], 0),
        verdict: 'fresh',
        reason: 'the fixture storyline is unchanged',
        cross_stream_evidence: [],
        proposed_action: 'noop',
        confidence: 0.9,
      }],
    });

    // The frozen corpus is the instance tree minus store/ (runtime
    // state; instances are git-less so there is nothing else to skip).
    cpSync(inst, INPUT, {
      recursive: true,
      filter: (src) => {
        const rel = relative(inst, src);
        return rel !== 'store' && !rel.startsWith(`store${sep}`);
      },
    });
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }

  writeManifest();
  console.log(`inputs written under ${INPUT} (+ fixture-manifest.json)`);
}

// --- freeze -----------------------------------------------------------------

export async function freeze(): Promise<void> {
  rmSync(EXPECTED, { recursive: true, force: true });
  const { renderAndWriteNews } = await import('../src/render/render-news-md.ts');
  const { renderAndWriteFp } = await import('../src/render/render-future-prediction-md.ts');
  const { initDb, connect } = await import('../src/db/db.ts');
  const { dumpSql } = await import('../src/db/dump.ts');
  // With todayIso pinned to the fixture Sunday, the only volatile dump
  // content is CURRENT_TIMESTAMP metadata — the epoch rewrite is the
  // whole normalization (no capture-day token needed, ever).
  const normalize = (s: string) => s
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g, '1970-01-01T00:00:00Z')
    .replace(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/g, '1970-01-01 00:00:00');
  const { ingestDay, ingestDayLocales } = await import('../src/ingest/ingest-sourcedata.ts');
  const { runGlossaryExtract } = await import('../src/ingest/glossary-extract.ts');
  const { runScore } = await import('../src/ingest/score.ts');
  const { runExport } = await import('../src/export/export.ts');

  const sdRoot = join(INPUT, 'data', 'sourcedata');
  // 1. renders — into input/ (they are inputs to gates/readmes on later
  //    days) and expected/render (the regression baseline).
  for (const day of DAYS) {
    for (const L of ['en', ...LOCALES]) {
      renderAndWriteNews(sdRoot, INPUT, day, L);
      renderAndWriteFp(sdRoot, INPUT, day, L);
    }
  }
  // Flat expected/render names (the layout the parity test reads).
  for (const day of DAYS)
    for (const L of ['en', ...LOCALES]) {
      w(join(EXPECTED, 'render', `news-${day}.${L}.md`),
        readFileSync(join(INPUT, 'data', 'daily-news', L, `news-${stem(day)}.md`), 'utf8'));
      w(join(EXPECTED, 'render', `future-prediction-${day}.${L}.md`),
        readFileSync(join(INPUT, 'data', 'future-prediction', L,
          `future-prediction-${stem(day)}.md`), 'utf8'));
    }

  // 2. DB build in a work-shaped root (v2 instance shape: everything
  //    under data/) — EXACTLY the recipe test/helpers/build-db.ts uses,
  //    so source_files rel paths and every derived hash match the test
  //    rebuild.
  const { mkdtempSync: mkdtemp2, symlinkSync: symlink2 } = await import('node:fs');
  const { tmpdir: tmpdir2 } = await import('node:os');
  const buildRoot = mkdtemp2(join(tmpdir2(), 'nf-freeze-db-'));
  mkdirSync(join(buildRoot, 'data'), { recursive: true });
  symlink2(sdRoot, join(buildRoot, 'data', 'sourcedata'));
  for (const part of ['daily-news', 'future-prediction', 'history', 'reference'])
    symlink2(join(INPUT, 'data', part), join(buildRoot, 'data', part));
  const dbFile = join(buildRoot, 'analytics.sqlite');
  initDb(dbFile);
  const db = connect(dbFile);
  // Read sourcedata THROUGH the symlink under buildRoot so source_files
  // stores the relative `data/sourcedata/...` path (exactly what the
  // buildGoldenDb test helper does — otherwise absolute vs relative
  // paths desync every derived hash).
  const ctx = {
    sourcedataRoot: join(buildRoot, 'data', 'sourcedata'),
    repoRootForRel: buildRoot, todayIso: SUNDAY,
  };
  for (const day of DAYS) {
    runGlossaryExtract(db, {
      newsFile: join(buildRoot, 'data', 'daily-news', 'en', `news-${stem(day)}.md`),
      seedYaml: join(buildRoot, 'data', 'reference', 'glossary.yml'),
      todayIso: SUNDAY,
    });
    const { pidByJsonId } = ingestDay(db, ctx, day);
    ingestDayLocales(db, ctx, day, pidByJsonId);
  }
  runScore(db);
  w(join(EXPECTED, 'db', 'analytics.dump.sql'), normalize(dumpSql(db)));

  // 3. exports (+ evidence-reverse), frozen AND staged into input/data/exports
  //    — later-day gates and the Sunday flow-check read them as inputs.
  const { buildEvidenceReverse } = await import('../src/export/evidence-reverse.ts');
  const outDir = join(EXPECTED, 'export');
  mkdirSync(outDir, { recursive: true });
  runExport(db, { outputDir: outDir, publishRoot: INPUT });
  w(join(outDir, 'evidence-reverse.json'), JSON.stringify(
    buildEvidenceReverse(db, { todayIso: SUNDAY }), null, 2));
  db.close();
  rmSync(buildRoot, { recursive: true, force: true });

  const dd = join(INPUT, 'data', 'exports');
  const EXPORTS = ['graph-tech.json', 'graph-business.json', 'graph-mix.json',
    'glossary.json', 'manifest.json', 'evidence-reverse.json',
    'prefix-tokens.json'];
  for (const f of EXPORTS)
    w(join(dd, f), readFileSync(join(outDir, f), 'utf8'));
  // Sunday 3-time-state: reader-facing snapshot + pre-review rollback.
  const snapStem = stem(SUNDAY);
  for (const f of ['graph-tech.json', 'graph-business.json', 'graph-mix.json', 'manifest.json']) {
    w(join(dd, 'snapshots', snapStem, f), readFileSync(join(outDir, f), 'utf8'));
    w(join(INPUT, 'data', 'history', 'snapshots', `${snapStem}-pre-review`, f),
      readFileSync(join(outDir, f), 'utf8'));
  }
  wj(join(dd, 'snapshots', 'index.json'), { snapshots: [snapStem], default: 'live' });
  const { schemaPath } = await import('../src/db/db.ts');
  w(join(INPUT, 'data', 'history', 'snapshots', `${snapStem}-pre-review`, 'schema.sql'),
    readFileSync(schemaPath(), 'utf8'));

  // README 3-day windows (the briefing chain's inputs).
  for (const L of ['', '.ja', '.es', '.fil']) {
    const seg = L === '' ? 'en' : L.slice(1);
    const blocks = [...DAYS].reverse().map(d => [
      `## ${d}`, '',
      `Fixture window entry for ${d}.`, '',
      `- [news-${stem(d)}.md](data/daily-news/${seg}/news-${stem(d)}.md)`,
      `- [future-prediction-${stem(d)}.md](data/future-prediction/${seg}/future-prediction-${stem(d)}.md)`,
      '',
    ].join('\n'));
    w(join(INPUT, `README${L}.md`),
      `# Fixture news board (${seg})\n\n${blocks.join('\n')}\n---\n`);
  }

  // 4. gate reports — frozen the same way the parity tests replay them.
  const { dailyFlowCheck } = await import('../src/gates/daily-flow-check.ts');
  const { checkTopicCoverage } = await import('../src/gates/check-topic-coverage.ts');
  const { postUpdateValidation } = await import('../src/gates/post-update-validation.ts');
  const { lintPaths } = await import('../src/render/lint-markdown-clean.ts');
  const { postWriteIntegrity } = await import('../src/render/post-write-integrity.ts');
  const { mkdtempSync, symlinkSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const rLocales = ['en', ...LOCALES];
  for (const day of DAYS) {
    const topic = checkTopicCoverage({ sourcedataDir: sdRoot, date: day });
    w(join(EXPECTED, 'gates', `${day}.topic.txt`),
      normalize(topic.lines.join('\n') + '\n'));
    const workRoot = mkdtempSync(join(tmpdir(), 'nf-freeze-'));
    let flowExit: number;
    try {
      mkdirSync(join(workRoot, 'data'), { recursive: true });
      symlinkSync(sdRoot, join(workRoot, 'data', 'sourcedata'));
      for (const part of ['daily-news', 'future-prediction', 'history', 'reference'])
        symlinkSync(join(INPUT, 'data', part), join(workRoot, 'data', part));
      const flow = dailyFlowCheck({ repoRoot: workRoot, date: day, mode: 'report-missing' });
      flowExit = flow.exit;
      w(join(EXPECTED, 'gates', `${day}.flow.txt`),
        normalize((flow.lines.join('\n') + '\n').replaceAll(workRoot, '<WORK>')));
    } finally {
      rmSync(workRoot, { recursive: true, force: true });
    }
    // render-parity reads lint/pwi exits off the frozen renders.
    const newsFiles = rLocales.map(L => join(EXPECTED, 'render', `news-${day}.${L}.md`));
    const fpFiles = rLocales.map(L => join(EXPECTED, 'render', `future-prediction-${day}.${L}.md`));
    wj(join(EXPECTED, 'gates', `${day}.json`), {
      topic: topic.exit,
      flow: flowExit,
      lint: lintPaths([...newsFiles, ...fpFiles]).exit,
      pwiNews: postWriteIntegrity('news', newsFiles).exit,
      pwiFp: postWriteIntegrity('future-prediction', fpFiles).exit,
    });
  }
  {
    // puv exits on a fresh build + export in a work-shaped root (the
    // same recipe the parity test uses).
    const workRoot = mkdtempSync(join(tmpdir(), 'nf-freeze-puv-'));
    try {
      mkdirSync(join(workRoot, 'data'), { recursive: true });
      symlinkSync(sdRoot, join(workRoot, 'data', 'sourcedata'));
      for (const part of ['daily-news', 'future-prediction', 'history', 'reference'])
        symlinkSync(join(INPUT, 'data', part), join(workRoot, 'data', part));
      const dbf = join(workRoot, 'analytics.sqlite');
      initDb(dbf);
      const db2 = connect(dbf);
      const ctx2 = {
        sourcedataRoot: join(workRoot, 'data', 'sourcedata'),
        repoRootForRel: workRoot, todayIso: SUNDAY,
      };
      for (const day of DAYS) {
        runGlossaryExtract(db2, {
          newsFile: join(workRoot, 'data', 'daily-news', 'en', `news-${stem(day)}.md`),
          seedYaml: join(workRoot, 'data', 'reference', 'glossary.yml'),
          todayIso: SUNDAY,
        });
        const { pidByJsonId } = ingestDay(db2, ctx2, day);
        ingestDayLocales(db2, ctx2, day, pidByJsonId);
      }
      runScore(db2);
      const puvOut = join(workRoot, 'data', 'exports');
      runExport(db2, { outputDir: puvOut, publishRoot: workRoot });
      db2.close();
      const common = { date: SUNDAY, db: dbf, exportsDir: puvOut, repoRoot: workRoot };
      wj(join(EXPECTED, 'gates', 'post-update-validation.json'), {
        [`news-${SUNDAY}`]: postUpdateValidation({ ...common, check: 'news' }).exit,
        [`fp-${SUNDAY}`]: postUpdateValidation({ ...common, check: 'future-prediction' }).exit,
        [`exports-${SUNDAY}`]: postUpdateValidation({ ...common, check: 'exports' }).exit,
      });
    } finally {
      rmSync(workRoot, { recursive: true, force: true });
    }
  }

  wj(join(EXPECTED, 'capture-log.json'), {
    captureDay: '<SYNTHETIC>',
    note: 'expected/ is frozen from the TS pipeline itself over the synthetic '
      + 'corpus (T12 self-regression baseline). The oracle-parity record '
      + 'lives in git history and design/verification/phase-c.md.',
  });
  console.log(`expected/ frozen under ${EXPECTED}`);
}

const mode = process.argv[2] ?? 'all';
if (mode === 'inputs' || mode === 'all') writeInputs();
if (mode === 'freeze' || mode === 'all') await freeze();
