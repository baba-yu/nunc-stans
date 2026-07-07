// TS port of app/skills/daily_flow_check.py — the universal "is today
// done?" gate (5 buckets). post_update_validation runs in-process; the
// oracle's subprocess-framing messages are mirrored for parity.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { postUpdateValidation } from './post-update-validation.ts';
import type { GateResult } from './post-update-validation.ts';
import { docsDataDir, FP_DIR, LOCALES, NON_EN_LOCALES, REPORT_DIR } from '../world-paths.ts';

function isSunday(date: string): boolean {
  return new Date(date + 'T12:00:00Z').getUTCDay() === 0;
}

function stem(date: string): string {
  return date.replaceAll('-', '');
}

function rel(root: string, p: string): string {
  return relative(root, p).replaceAll('\\', '/');
}

function checkFiles(repoRoot: string, date: string): string[] {
  const errs: string[] = [];
  for (const [kind, sub] of [['news', REPORT_DIR], ['future-prediction', FP_DIR]] as const) {
    const fileStem = `${kind}-${stem(date)}`;
    for (const l of LOCALES) {
      const p = join(repoRoot, sub, l, `${fileStem}.md`);
      if (!existsSync(p)) errs.push(`missing: ${rel(repoRoot, p)}`);
      else if (statSync(p).size === 0) errs.push(`empty: ${rel(repoRoot, p)}`);
    }
  }
  return errs;
}

function checkDbPopulation(repoRoot: string, date: string): string[] {
  const res = postUpdateValidation({
    check: 'all', date,
    db: join(repoRoot, 'app/data/analytics.sqlite'),
    docsDataDir: docsDataDir(repoRoot),
    repoRoot,
  });
  const errs: string[] = [];
  if (res.exit !== 0) {
    for (const line of res.lines)
      if (line.startsWith('FAIL')) errs.push(`post_update_validation: ${line}`);
    if (!errs.length)
      errs.push(
        `post_update_validation exited ${res.exit} but produced no FAIL lines; `
        + `stderr='${(res.stderr ?? '').slice(0, 200).replaceAll('\\', '\\\\').replaceAll('\n', '\\n')}'`);
  }
  return errs;
}

function checkSundayArtifacts(repoRoot: string, date: string): string[] {
  if (!isSunday(date)) return [];
  const errs: string[] = [];
  const s = stem(date);
  const dormant = join(repoRoot, 'memory/dormant', `dormant-${s}.md`);
  if (!existsSync(dormant))
    errs.push(`missing Sunday artifact: ${rel(repoRoot, dormant)} (4_weekly_memory Step 5 did not run)`);
  const review = join(repoRoot, 'memory/theme-review', `theme-review-${s}.md`);
  if (!existsSync(review))
    errs.push(`missing Sunday artifact: ${rel(repoRoot, review)} (5_weekly_theme_review Step 5 did not run)`);
  const preReview = join(repoRoot, 'memory/snapshots', `${s}-pre-review`);
  if (!existsSync(preReview)) {
    errs.push(
      `missing Sunday artifact: ${rel(repoRoot, preReview)}/ `
      + `(5_weekly_theme_review Step 2 did not snapshot rollback target)`);
  } else {
    for (const required of ['schema.sql', 'graph-tech.json', 'graph-business.json',
      'graph-mix.json', 'manifest.json'])
      if (!existsSync(join(preReview, required)))
        errs.push(`missing in pre-review snapshot: ${rel(repoRoot, preReview)}/${required}`);
  }
  const dashboardSnap = join(docsDataDir(repoRoot), 'snapshots', s);
  if (!existsSync(dashboardSnap)) {
    errs.push(
      `missing Sunday artifact: ${rel(repoRoot, dashboardSnap)}/ `
      + `(5_weekly_theme_review Step 2 did not snapshot reader-facing dashboard)`);
  } else {
    for (const required of ['graph-tech.json', 'graph-business.json', 'graph-mix.json', 'manifest.json'])
      if (!existsSync(join(dashboardSnap, required)))
        errs.push(`missing in dashboard snapshot: ${rel(repoRoot, dashboardSnap)}/${required}`);
  }
  const index = join(docsDataDir(repoRoot), 'snapshots', 'index.json');
  if (!existsSync(index)) {
    errs.push(`missing: ${rel(repoRoot, index)}`);
  } else {
    try {
      const idx = JSON.parse(readFileSync(index, 'utf8'));
      if (!(idx.snapshots ?? []).includes(s))
        errs.push(
          `docs/data/snapshots/index.json does not list '${s}' `
          + `(SNAP dropdown will not surface today's snapshot)`);
    } catch (e) {
      errs.push(`docs/data/snapshots/index.json invalid: ${e instanceof Error ? e.message : e}`);
    }
  }
  return errs;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function checkReadmes(repoRoot: string, date: string): string[] {
  const errs: string[] = [];
  const base = Date.parse(date + 'T12:00:00Z');
  const expectedDates = [0, 1, 2]
    .map(i => new Date(base - i * 86400000).toISOString().slice(0, 10))
    .sort();
  const pyList = (xs: string[]) => `[${xs.map(x => `'${x}'`).join(', ')}]`;
  for (const l of ['', ...NON_EN_LOCALES.map(x => `.${x}`)]) {
    const path = join(repoRoot, `README${l}.md`);
    const relPath = rel(repoRoot, path);
    if (!existsSync(path)) {
      errs.push(`missing: ${relPath}`);
      continue;
    }
    const text = readFileSync(path, 'utf8');
    if (!new RegExp(`^## ${escapeRe(date)}\\s*$`, 'm').test(text))
      errs.push(
        `${relPath}: missing \`## ${date}\` header (3_daily_briefing Step 2 did not include today)`);
    const headers = [...text.matchAll(/^## (\d{4}-\d{2}-\d{2})\s*$/gm)].map(m => m[1]);
    if (headers.length !== 3) {
      errs.push(
        `${relPath}: has ${headers.length} \`## YYYY-MM-DD\` headers, `
        + `expected 3 (window: ${pyList(expectedDates)})`);
    } else {
      const actual = [...headers].sort();
      if (actual.join() !== expectedDates.join())
        errs.push(`${relPath}: window is ${pyList(actual)}, expected ${pyList(expectedDates)}`);
    }
    const locSeg = l === '' ? 'en' : l.slice(1);
    for (const [kind, sub] of [['news', REPORT_DIR], ['future-prediction', FP_DIR]] as const) {
      const link = `[${kind}-${stem(date)}.md](${sub}/${locSeg}/${kind}-${stem(date)}.md)`;
      if (!text.includes(link))
        errs.push(`${relPath}: missing today's link \`${link}\` (locale-link routing rule)`);
    }
  }
  return errs;
}

function checkDashboardHygiene(repoRoot: string): string[] {
  const errs: string[] = [];
  const mPath = join(docsDataDir(repoRoot), 'manifest.json');
  if (!existsSync(mPath)) {
    errs.push(`missing: ${rel(repoRoot, mPath)}`);
  } else {
    try {
      const m = JSON.parse(readFileSync(mPath, 'utf8'));
      const locales = m.locales ?? [];
      if (locales.length !== 4)
        errs.push(`docs/data/manifest.json has ${locales.length} locales, expected 4`);
      if (m.default_locale !== 'en')
        errs.push(
          `docs/data/manifest.json default_locale=`
          + `${m.default_locale === undefined || m.default_locale === null ? 'None' : `'${m.default_locale}'`}, expected 'en'`);
    } catch (e) {
      errs.push(`docs/data/manifest.json invalid: ${e instanceof Error ? e.message : e}`);
    }
  }
  for (const [relPath, tailRe] of [
    ['docs/index.html', /<\/html>\s*$/],
    ['docs/assets/app.js', /\}\)\(\);?\s*$/],
    ['docs/assets/styles.css', /\}\s*$/],
  ] as const) {
    const p = join(repoRoot, relPath);
    if (!existsSync(p)) {
      errs.push(`missing: ${relPath}`);
      continue;
    }
    const txt = readFileSync(p, 'utf8');
    if (!tailRe.test(txt)) errs.push(`${relPath}: tail does not match /${tailRe.source}/`);
  }
  const dbPath = join(repoRoot, 'app/data/analytics.sqlite');
  if (!existsSync(dbPath)) {
    errs.push(`missing: ${rel(repoRoot, dbPath)}`);
  } else {
    try {
      const db = new Database(dbPath, { readonly: true });
      const row = db.pragma('integrity_check', { simple: true });
      db.close();
      if (row !== 'ok') errs.push(`sqlite PRAGMA integrity_check: ${row}`);
    } catch (e) {
      errs.push(`sqlite PRAGMA integrity_check raised: ${e instanceof Error ? e.message : e}`);
    }
  }
  return errs;
}

export function dailyFlowCheck(args: {
  repoRoot: string; date: string; mode: 'strict' | 'report-missing';
}): GateResult {
  const root = resolve(args.repoRoot);
  const sun = isSunday(args.date);
  const lines: string[] = [];
  lines.push(`daily-flow-check :: date=${args.date} (${sun ? 'Sun' : 'Mon-Sat'})`);
  lines.push(`  repo-root: ${root}`);
  lines.push('');
  let allPass = true;
  const run = (name: string, errs: string[]): boolean => {
    if (errs.length) {
      lines.push(`FAIL ${name}: ${errs.length} issue(s)`);
      for (const e of errs) lines.push(`  - ${e}`);
      return false;
    }
    lines.push(`OK ${name}`);
    return true;
  };
  allPass = run(`news+FP markdown files (${args.date})`, checkFiles(root, args.date)) && allPass;
  allPass = run(`DB population via post_update_validation (${args.date})`,
    checkDbPopulation(root, args.date)) && allPass;
  if (sun)
    allPass = run(`Sunday artifacts (dormant + theme-review + snapshots) (${args.date})`,
      checkSundayArtifacts(root, args.date)) && allPass;
  allPass = run(`READMEs (3-day window including ${args.date})`,
    checkReadmes(root, args.date)) && allPass;
  allPass = run('dashboard hygiene (manifest + assets + sqlite)',
    checkDashboardHygiene(root)) && allPass;
  lines.push('');
  lines.push(allPass ? 'ALL GREEN — today is done' : 'NOT DONE — see FAIL lines above');
  const exit = args.mode === 'report-missing' ? 0 : (allPass ? 0 : 1);
  return { exit, lines };
}
