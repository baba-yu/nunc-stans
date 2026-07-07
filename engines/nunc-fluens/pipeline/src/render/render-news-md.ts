// TS port of app/skills/render_news_md.py — deterministic renderer for
// data/daily-news/<locale>/news-YYYYMMDD.md from sourcedata JSON.
// Byte-parity with the oracle is asserted against the golden corpus.
//
// API takes explicit roots instead of the oracle's __file__-anchored
// repo_root: `sourcedataRoot` is <newsRepo>/app/sourcedata in production
// and goldens/input/sourcedata in tests; `publishRoot` is the checkout
// the data/daily-news/ tree lives in.
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  changeLogFileToDict, headlinesFileToDict, newsSectionFileToDict,
  parseChangeLogFile, parseHeadlinesFile, parseNewsSectionFile,
  parsePredictionsFile, predictionsFileToDict,
} from '../schemas/sourcedata.ts';
import { aiNotice } from './notice.ts';
import { DAILY_NEWS_REL } from '../world-paths.ts';
import { buildEnv, emptyListToNull, normalizeRendered } from './env.ts';
import { postWriteIntegrity } from './post-write-integrity.ts';

export function coverageWindow(dateIso: string): string {
  const d = Date.parse(dateIso + 'T12:00:00Z');
  const start = new Date(d - 2 * 86400000).toISOString().slice(0, 10);
  return `${start} to ${dateIso} (3-day rolling window)`;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function dateDir(sourcedataRoot: string, dateIso: string, locale: string): string {
  return locale === 'en'
    ? join(sourcedataRoot, dateIso)
    : join(sourcedataRoot, 'locales', dateIso, locale);
}

function loadJsons(sourcedataRoot: string, dateIso: string, locale: string): Record<string, unknown> {
  const base = dateDir(sourcedataRoot, dateIso, locale);
  const out: Record<string, unknown> = {};

  const predPath = join(base, 'predictions.json');
  out.predictions = existsSync(predPath)
    ? predictionsFileToDict(parsePredictionsFile(readJson(predPath)))
    : { date: dateIso, predictions: [] };

  const hlPath = join(base, 'headlines.json');
  const headlines = existsSync(hlPath)
    ? headlinesFileToDict(parseHeadlinesFile(readJson(hlPath)))
    : { date: dateIso, technical: [], plain: [] };
  // Jinja2-truthiness shim (see env.ts): empty citation lists → null.
  for (const t of headlines.technical as Array<Record<string, unknown>>)
    t.citations = emptyListToNull(t.citations as unknown[]);
  out.headlines = headlines;

  const clPath = join(base, 'change_log.json');
  out.change_log = existsSync(clPath)
    ? changeLogFileToDict(parseChangeLogFile(readJson(clPath)))
    : { date: dateIso, vs_date: '', items: [] };

  const nsPath = join(base, 'news_section.json');
  const newsSection = existsSync(nsPath)
    ? newsSectionFileToDict(parseNewsSectionFile(readJson(nsPath)))
    : { date: dateIso, sections: [] };
  for (const s of newsSection.sections as Array<Record<string, unknown>>)
    for (const b of s.bullets as Array<Record<string, unknown>>)
      b.citations = emptyListToNull(b.citations as unknown[]);
  out.news_section = newsSection;

  return out;
}

export function renderNewsDay(sourcedataRoot: string, dateIso: string, locale = 'en'): string {
  const env = buildEnv();
  const ctx = {
    date_iso: dateIso,
    date_compact: dateIso.replaceAll('-', ''),
    coverage_window: coverageWindow(dateIso),
    locale,
    ai_notice_block: aiNotice(locale),
    ...loadJsons(sourcedataRoot, dateIso, locale),
  };
  return normalizeRendered(env.render('news.md.j2', ctx));
}

export function newsOutputPath(publishRoot: string, dateIso: string, locale: string): string {
  return join(publishRoot, DAILY_NEWS_REL, locale, `news-${dateIso.replaceAll('-', '')}.md`);
}

export function writeAtomic(path: string, text: string): void {
  mkdirSync(join(path, '..'), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  try {
    writeFileSync(tmp, text, { encoding: 'utf8' });
    renameSync(tmp, path);
  } catch (err) {
    rmSync(tmp, { force: true });
    throw err;
  }
}

/** Render + atomic write + post-write-integrity (kind=news). Mirrors
 * render_and_write: on integrity failure the file stays on disk and an
 * Error carries the report. */
export function renderAndWriteNews(
  sourcedataRoot: string, publishRoot: string, dateIso: string, locale = 'en',
): string {
  const rendered = renderNewsDay(sourcedataRoot, dateIso, locale);
  const out = newsOutputPath(publishRoot, dateIso, locale);
  writeAtomic(out, rendered);
  const r = postWriteIntegrity('news', [out]);
  if (r.exit !== 0)
    throw new Error(`post-write-integrity failed for ${out}:\n${r.lines.join('\n')}`);
  return out;
}
