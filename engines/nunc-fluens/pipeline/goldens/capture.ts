// Golden-master capture harness (Phase C, T1).
//
//   node capture.ts stage [<upstream-root>]   copy fixture inputs from the
//                                             upstream news checkout into
//                                             goldens/input/ (committed)
//   node capture.ts run                       rebuild work/ from input/ +
//                                             the Python oracle app, run the
//                                             deterministic chain, write
//                                             goldens/expected/ (committed)
//
// The oracle (engines/nunc-fluens/app) anchors its repo root at
// Path(__file__).parents[2], so `run` copies the app code into work/ and
// executes everything with cwd=work. Volatile fields are normalized per
// fixture-manifest.json `normalization` before anything is stored.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const M = JSON.parse(fs.readFileSync(path.join(HERE, 'fixture-manifest.json'), 'utf8'));
const ENGINE = path.resolve(HERE, '..', '..'); // engines/nunc-fluens
const INPUT = path.join(HERE, 'input');
const WORK = path.join(HERE, 'work');
const EXPECTED = path.join(HERE, 'expected');

const LOCALES: string[] = M.locales;
const RENDER_DAYS: string[] = M.renderDays;

function daysBetween(startIso: string, endIso: string): string[] {
  const out: string[] = [];
  // Noon UTC avoids DST edges; date-only math.
  let t = Date.parse(startIso + 'T12:00:00Z');
  const end = Date.parse(endIso + 'T12:00:00Z');
  for (; t <= end; t += 86400000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}
const DB_DAYS = daysBetween(M.dbRange.start, M.dbRange.end);
const WINDOW_DAYS = daysBetween(M.reportWindow.start, M.reportWindow.end);
const ALL_SD_DAYS = [...new Set([...DB_DAYS, ...RENDER_DAYS])].sort();

function cpIf(src: string, dst: string) {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.cpSync(src, dst, { recursive: true, filter: (s) => !s.includes('__pycache__') });
  return true;
}

function compact(d: string) { return d.replaceAll('-', ''); }

// ---------------------------------------------------------------- stage ----
// Inputs come from `git archive` at the manifest's pinned commit — never
// from the upstream working tree, so a mid-flight daily run cannot leak
// into the fixtures (staging rule, 2026-07-06).
function extractPinned(upstreamRepo: string): string {
  const commit = M.upstream.commit as string;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-stage-'));
  const wanted = ['app/sourcedata', 'report', 'future-prediction', 'memory', 'reference', 'references.txt'];
  const tracked = execFileSync('git',
    ['-C', upstreamRepo, 'ls-tree', '--name-only', commit, '--', ...wanted],
    { encoding: 'utf8' }).split('\n').filter(Boolean);
  execFileSync('sh', ['-c',
    `git -C "${upstreamRepo}" archive ${commit} -- ${tracked.join(' ')} | tar -x -C "${tmp}"`,
  ], { stdio: ['ignore', 'inherit', 'inherit'] });
  for (const w of wanted)
    if (!tracked.includes(w)) {
      console.error(`warning: ${w} is not tracked at ${commit} — falling back to the working tree`);
      cpIf(path.join(upstreamRepo, w), path.join(tmp, w));
    }
  return tmp;
}

function stage(upstreamRepo: string) {
  const upstream = extractPinned(upstreamRepo);
  fs.rmSync(INPUT, { recursive: true, force: true });
  for (const d of ALL_SD_DAYS) {
    if (!cpIf(path.join(upstream, 'app/sourcedata', d), path.join(INPUT, 'sourcedata', d)))
      throw new Error(`missing upstream sourcedata for ${d}`);
    cpIf(path.join(upstream, 'app/sourcedata/locales', d), path.join(INPUT, 'sourcedata/locales', d));
  }
  let staged = 0;
  for (const d of WINDOW_DAYS) for (const L of LOCALES) {
    staged += +cpIf(
      path.join(upstream, 'report', L, `news-${compact(d)}.md`),
      path.join(INPUT, 'report', L, `news-${compact(d)}.md`));
    staged += +cpIf(
      path.join(upstream, 'future-prediction', L, `future-prediction-${compact(d)}.md`),
      path.join(INPUT, 'future-prediction', L, `future-prediction-${compact(d)}.md`));
  }
  cpIf(path.join(upstream, 'memory/dormant'), path.join(INPUT, 'memory/dormant'));
  for (const f of fs.readdirSync(path.join(upstream, 'memory/theme-review')))
    if (f >= `theme-review-${compact(M.reportWindow.start)}`)
      cpIf(path.join(upstream, 'memory/theme-review', f), path.join(INPUT, 'memory/theme-review', f));
  cpIf(path.join(upstream, 'reference'), path.join(INPUT, 'reference'));
  cpIf(path.join(upstream, 'references.txt'), path.join(INPUT, 'references.txt'));
  const H = M.historicalPredictionDates;
  for (const d of daysBetween(H.start, H.end)) {
    cpIf(path.join(upstream, 'app/sourcedata', d, 'predictions.json'),
      path.join(INPUT, 'sourcedata', d, 'predictions.json'));
    for (const L of ['ja', 'es', 'fil'])
      cpIf(path.join(upstream, 'app/sourcedata/locales', d, L, 'predictions.json'),
        path.join(INPUT, 'sourcedata/locales', d, L, 'predictions.json'));
  }
  fs.rmSync(upstream, { recursive: true, force: true });
  console.log(`staged: ${ALL_SD_DAYS.length} sourcedata days, ${staged} report/fp files (pinned ${M.upstream.commit})`);
}

// ------------------------------------------------------------- stage-ci ----
// Copy input/ into the engine root in the upstream repo layout so the
// Python test suite finds its live-data fixtures (paths are gitignored
// there). Used by CI before pytest and for local verification.
function stageCi() {
  cpIf(path.join(INPUT, 'sourcedata'), path.join(ENGINE, 'app/sourcedata'));
  // reference/ is deliberately NOT staged: it is tracked in the monorepo
  // (the tests use the repo's own copy); everything below is gitignored.
  for (const part of ['report', 'future-prediction', 'memory', 'references.txt'])
    cpIf(path.join(INPUT, part), path.join(ENGINE, part));
  console.log(`staged fixtures into ${ENGINE}`);
}

// ------------------------------------------------------------------ run ----
function pickPython(): string {
  const candidates = [process.env.GOLDEN_PY,
    path.join(os.homedir(), '.pyenv/versions/3.11.11/bin/python'),
    'python3'].filter(Boolean) as string[];
  for (const c of candidates) {
    const r = spawnSync(c, ['-c', 'import jinja2, yaml'], { encoding: 'utf8' });
    if (r.status === 0) return c;
  }
  throw new Error('no python with jinja2+pyyaml found; set GOLDEN_PY');
}

type Ran = { exit: number; out: string };
function py(PY: string, args: string[], allowFail = false): Ran {
  const r = spawnSync(PY, args, {
    cwd: WORK, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    // PYTHONHASHSEED pinned: set-iteration order feeds float sums in the
    // oracle; unpinned hashing made captures run-dependent (see the
    // idf-tie determinism fix in app/src/ingest.py).
    env: { ...process.env, PYTHONPATH: WORK, PYTHONHASHSEED: '0' },
  });
  if (r.error) throw r.error;
  const exit = r.status ?? -1;
  if (exit !== 0 && !allowFail)
    throw new Error(`${args.join(' ')} -> exit ${exit}\n${r.stdout}\n${r.stderr}`);
  return { exit, out: (r.stdout ?? '') + (r.stderr ?? '') };
}

const CAPTURE_DAY = new Date().toISOString().slice(0, 10);
function normalize(text: string): string {
  return text
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g, '1970-01-01T00:00:00Z')
    .replace(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/g, '1970-01-01 00:00:00')
    .replaceAll(CAPTURE_DAY, '<CAPTURE_DAY>')
    .replaceAll(WORK, '<WORK>');
}

function writeExpected(rel: string, content: string, normalized = false) {
  const p = path.join(EXPECTED, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, normalized ? normalize(content) : content);
}

async function run() {
  // The capture-day normalization token-replaces every occurrence of
  // today's date — if today IS a fixture day, legitimate date strings
  // get clobbered (bit us when 2026-07-05 was captured on 2026-07-05).
  if ([...RENDER_DAYS, ...DB_DAYS].includes(CAPTURE_DAY))
    throw new Error(
      `capture day ${CAPTURE_DAY} collides with a fixture day — run the capture on another (UTC) day`);
  const PY = pickPython();
  const log: Record<string, unknown> = { python: PY, captureDay: CAPTURE_DAY, sanity: {} };

  // -- assemble work/ --------------------------------------------------
  fs.rmSync(WORK, { recursive: true, force: true });
  fs.rmSync(EXPECTED, { recursive: true, force: true });
  for (const part of ['src', 'skills', 'templates', 'migrations', 'pyproject.toml'])
    cpIf(path.join(ENGINE, 'app', part), path.join(WORK, 'app', part));
  fs.writeFileSync(path.join(WORK, 'app', '__init__.py'), '');
  cpIf(path.join(INPUT, 'sourcedata'), path.join(WORK, 'app/sourcedata'));
  for (const part of ['report', 'future-prediction', 'memory', 'reference', 'references.txt'])
    cpIf(path.join(INPUT, part), path.join(WORK, part));
  fs.mkdirSync(path.join(WORK, 'app/data'), { recursive: true });
  fs.mkdirSync(path.join(WORK, 'docs/data'), { recursive: true });

  // -- renders (byte goldens) ------------------------------------------
  const sanity: Record<string, string> = {};
  for (const d of RENDER_DAYS) for (const L of LOCALES) {
    for (const [mod, dir, stem] of [
      ['app.skills.render_news_md', 'report', 'news'],
      ['app.skills.render_future_prediction_md', 'future-prediction', 'future-prediction'],
    ] as const) {
      py(PY, ['-m', mod, '--date', d, '--locale', L, '--repo-root', '.', '--write']);
      const rel = `${dir}/${L}/${stem}-${compact(d)}.md`;
      const rendered = fs.readFileSync(path.join(WORK, rel), 'utf8');
      writeExpected(`render/${stem}-${d}.${L}.md`, rendered);
      const committed = path.join(INPUT, rel);
      sanity[`${stem}-${d}.${L}`] = !fs.existsSync(committed) ? 'no-committed-copy'
        : fs.readFileSync(committed, 'utf8') === rendered ? 'match' : 'DIFFERS-from-history';
    }
  }
  log.sanity = sanity;

  // -- per-day gates ----------------------------------------------------
  for (const d of RENDER_DAYS) {
    const gates: Record<string, number> = {};
    gates.lint = py(PY, ['-m', 'app.skills.lint_markdown_clean', '--date', d], true).exit;
    gates.pwiNews = py(PY, ['-m', 'app.skills.post_write_integrity', '--kind', 'news',
      ...LOCALES.flatMap(L => ['--path', `report/${L}/news-${compact(d)}.md`])], true).exit;
    gates.pwiFp = py(PY, ['-m', 'app.skills.post_write_integrity', '--kind', 'future-prediction',
      ...LOCALES.flatMap(L => ['--path', `future-prediction/${L}/future-prediction-${compact(d)}.md`])], true).exit;
    // Gate reports carry no genuine today-stamps — only fixture dates
    // and the work path. The capture-day rule must NOT apply here (it
    // clobbers fixture dates when the capture day collides).
    const normalizeGates = (text: string) =>
      text.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g, '1970-01-01T00:00:00Z')
        .replaceAll(WORK, '<WORK>');
    const topic = py(PY, ['-m', 'app.skills.check_topic_coverage', '--date', d], true);
    gates.topic = topic.exit;
    writeExpected(`gates/${d}.topic.txt`, normalizeGates(topic.out));
    const flow = py(PY, ['-m', 'app.skills.daily_flow_check', '--date', d, '--report-missing'], true);
    gates.flow = flow.exit;
    writeExpected(`gates/${d}.flow.txt`, normalizeGates(flow.out));
    writeExpected(`gates/${d}.json`, JSON.stringify(gates, null, 2) + '\n');
  }

  // -- DB build + dump ---------------------------------------------------
  py(PY, ['-m', 'app.src.cli', 'init']);
  for (const d of DB_DAYS) {
    py(PY, ['-m', 'app.skills.extract_glossary_candidates',
      '--news-file', `report/en/news-${compact(d)}.md`,
      '--db', 'app/data/analytics.sqlite', '--seed-yaml', 'reference/glossary.yml']);
    py(PY, ['-m', 'app.src.cli', 'ingest-sourcedata', '--date', d]);
  }
  py(PY, ['-m', 'app.src.cli', 'score']);
  // Serialize with the pipeline's own dumper (src/db/dump.ts) so the
  // TS parity comparison uses one serializer on both sides — CPython's
  // iterdump formats REALs differently across libsqlite3 versions.
  const { dumpSql } = await import('../src/db/dump.ts');
  const Database = (await import('better-sqlite3')).default;
  const oracleDb = new Database(path.join(WORK, 'app/data/analytics.sqlite'), { readonly: true });
  try {
    writeExpected('db/analytics.dump.sql', dumpSql(oracleDb), true);
  } finally {
    oracleDb.close();
  }

  // -- export -------------------------------------------------------------
  py(PY, ['-m', 'app.src.cli', 'export']);
  for (const f of fs.readdirSync(path.join(WORK, 'docs/data')))
    if (f.endsWith('.json'))
      writeExpected(`export/${f}`, fs.readFileSync(path.join(WORK, 'docs/data', f), 'utf8'), true);

  // -- post-ingest validations (days inside the DB range) ----------------
  const sun = M.sundayDay as string;
  const puv: Record<string, number> = {};
  puv[`news-${sun}`] = py(PY, ['-m', 'app.skills.post_update_validation', '--check', 'news', '--date', sun], true).exit;
  puv[`fp-${sun}`] = py(PY, ['-m', 'app.skills.post_update_validation', '--check', 'future-prediction', '--date', sun], true).exit;
  puv[`exports-${sun}`] = py(PY, ['-m', 'app.skills.post_update_validation', '--check', 'exports', '--date', sun], true).exit;
  writeExpected('gates/post-update-validation.json', JSON.stringify(puv, null, 2) + '\n');

  writeExpected('capture-log.json', JSON.stringify(log, null, 2) + '\n');
  console.log('capture complete');
  console.log(JSON.stringify(sanity, null, 2));
}

const cmd = process.argv[2];
if (cmd === 'stage') stage(process.argv[3] ?? path.join(os.homedir(), 'news'));
else if (cmd === 'stage-ci') stageCi();
else if (cmd === 'run') await run();
else { console.error('usage: node capture.ts stage [upstream] | stage-ci | run'); process.exit(2); }
