// Ports of the news_parser helpers the export layer uses: BOLD_RE
// bold-hint extraction, scope-prefix stripping, and the clause-split
// short-label derivation.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const BOLD_RE = /\*\*([^*]+)\*\*/;

/** Single source of the scope-prefix strip list (P8). The dashboard's
 * cleanPredictionTitle builds its regexes from the copy runExport
 * drops into the export dir, so both surfaces strip the same tokens.
 * Loaded via readFileSync + JSON.parse (the db.ts/schema.sql pattern)
 * rather than a JSON import attribute, which node/vitest/esbuild do
 * not all agree on yet. */
export function prefixTokensPath(): string {
  return join(import.meta.dirname, 'prefix-tokens.json');
}

const PREFIX_TOKENS: string[] = JSON.parse(readFileSync(prefixTokensPath(), 'utf8'));

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const PREFIX_ALT = [...PREFIX_TOKENS]
  .sort((a, b) => b.length - a.length)
  .map(escapeRe)
  .join('|');

const PREFIX_FULL_RE = new RegExp(String.raw`^\s*\(\s*(?:${PREFIX_ALT})\s*\)\s*`, 'i');
const PREFIX_HALF_RE = new RegExp(String.raw`^\s*(?:${PREFIX_ALT})\s*\)\s*`, 'i');

export function stripScopePrefix(s: string): string {
  if (!s) return s;
  let prev: string | null = null;
  while (prev !== s) {
    prev = s;
    s = s.replace(PREFIX_FULL_RE, '');
    s = s.replace(PREFIX_HALF_RE, '');
  }
  return s;
}

export function boldHint(s: string | null): string | null {
  if (!s) return null;
  const m = BOLD_RE.exec(s);
  return m ? m[1].trim() : null;
}

/** Python str.strip(chars): remove any of the chars from both ends. */
function stripChars(s: string, chars: string): string {
  let start = 0;
  let end = s.length;
  while (start < end && chars.includes(s[start])) start++;
  while (end > start && chars.includes(s[end - 1])) end--;
  return s.slice(start, end);
}

const STRIP_SET = ' 　—-:：「」『』"\'()[]{}';

export function deriveShortLabel(summary: string, hint: string | null, fallbackIdx: number): string {
  let base = hint || summary;
  base = stripChars(base.replace(/\s+/g, ' '), STRIP_SET);
  base = stripScopePrefix(base).trim();
  for (const sep of ['—', '――', ' - ', '。', '、', '：', '. ']) {
    const i = base.indexOf(sep);
    if (i !== -1) {
      base = base.slice(0, i).trim();
      break;
    }
  }
  base = stripScopePrefix(base).trim();
  if (!base) base = `Prediction ${fallbackIdx}`;
  return base;
}
