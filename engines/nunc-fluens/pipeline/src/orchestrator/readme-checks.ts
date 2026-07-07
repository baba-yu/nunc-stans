// TS port of the link-routing check from
// design/archive/scheduled/3_daily_briefing-checks.md (Step 3): every link in a
// non-English README must use its own locale segment, or fall back to
// /en/ only when the locale file genuinely does not exist.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DAILY_NEWS_REL, FP_REL, NON_EN_LOCALES } from '../world-paths.ts';

const LINK_HEAD_RE = new RegExp(`\\((${DAILY_NEWS_REL}|${FP_REL})/`);
const LINK_RE = new RegExp(`\\((${DAILY_NEWS_REL}|${FP_REL})/([^)]+)\\)`);

export function checkReadmeLinks(publishRoot: string): { exit: number; lines: string[] } {
  const lines: string[] = [];
  let fail = 0;
  for (const L of NON_EN_LOCALES) {
    const readme = join(publishRoot, `README.${L}.md`);
    if (!existsSync(readme)) continue;
    const text = readFileSync(readme, 'utf8');
    for (const line of text.split('\n')) {
      if (!LINK_HEAD_RE.test(line)) continue;
      const m = LINK_RE.exec(line);
      if (!m) continue;
      const path = `${m[1]}/${m[2]}`;
      // The locale segment is the first component AFTER the (possibly
      // multi-segment) dir constant — m[2] starts with it.
      const seg = m[2].split('/')[0];
      if (seg === L) continue;
      if (seg === 'en') {
        const locPath = path.replace('/en/', `/${L}/`);
        if (!existsSync(join(publishRoot, locPath))) continue;
        lines.push(`FAIL README.${L}.md links into /en/ but ${locPath} exists: ${line}`);
        fail = 1;
      } else {
        lines.push(`FAIL README.${L}.md has unexpected locale segment '${seg}': ${line}`);
        fail = 1;
      }
    }
  }
  return { exit: fail, lines };
}
