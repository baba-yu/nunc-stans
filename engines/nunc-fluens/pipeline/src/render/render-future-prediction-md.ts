// TS port of app/skills/render_future_prediction_md.py — deterministic
// renderer for future-prediction/<locale>/future-prediction-YYYYMMDD.md.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bridgesFileToDict, parseBridgesFile } from '../schemas/sourcedata.ts';
import { aiNoticeFp } from './notice.ts';
import { buildEnv, normalizeRendered } from './env.ts';
import { dateDir, writeAtomic } from './render-news-md.ts';
import { postWriteIntegrity } from './post-write-integrity.ts';

export function fpCoverageWindow(dateIso: string): string {
  const d = Date.parse(dateIso + 'T12:00:00Z');
  const start = new Date(d - 7 * 86400000).toISOString().slice(0, 10);
  const end = new Date(d - 1 * 86400000).toISOString().slice(0, 10);
  return `predictions from ${start} through ${end} (last 7 days, `
    + `excluding today). Today's news report is for ${dateIso}.`;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Optional summary.json — keys kept only when non-blank strings; null
 * when the file is missing or nothing survives (mirrors _load_summary). */
function loadSummary(base: string): Record<string, string> | null {
  const sp = join(base, 'summary.json');
  if (!existsSync(sp)) return null;
  const raw = readJson(sp);
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const out: Record<string, string> = {};
  for (const key of ['plain_language', 'findings', 'relation_to_my_preds']) {
    const v = (raw as Record<string, unknown>)[key];
    if (typeof v === 'string' && v.trim()) out[key] = v;
  }
  return Object.keys(out).length ? out : null;
}

function loadJsons(sourcedataRoot: string, dateIso: string, locale: string): Record<string, unknown> {
  const base = dateDir(sourcedataRoot, dateIso, locale);
  const bridgesPath = join(base, 'bridges.json');
  const bridges = existsSync(bridgesPath)
    ? bridgesFileToDict(parseBridgesFile(readJson(bridgesPath)))
    : { date: dateIso, validation_rows: [] };
  return { bridges, summary: loadSummary(base) };
}

export function renderFpDay(sourcedataRoot: string, dateIso: string, locale = 'en'): string {
  const env = buildEnv();
  const ctx = {
    date_iso: dateIso,
    coverage_window: fpCoverageWindow(dateIso),
    locale,
    ai_notice_block: aiNoticeFp(locale),
    ...loadJsons(sourcedataRoot, dateIso, locale),
  };
  return normalizeRendered(env.render('future_prediction.md.j2', ctx));
}

export function fpOutputPath(publishRoot: string, dateIso: string, locale: string): string {
  return join(publishRoot, 'future-prediction', locale,
    `future-prediction-${dateIso.replaceAll('-', '')}.md`);
}

export function renderAndWriteFp(
  sourcedataRoot: string, publishRoot: string, dateIso: string, locale = 'en',
): string {
  const rendered = renderFpDay(sourcedataRoot, dateIso, locale);
  const out = fpOutputPath(publishRoot, dateIso, locale);
  writeAtomic(out, rendered);
  const r = postWriteIntegrity('future-prediction', [out]);
  if (r.exit !== 0)
    throw new Error(`post-write-integrity failed for ${out}:\n${r.lines.join('\n')}`);
  return out;
}
