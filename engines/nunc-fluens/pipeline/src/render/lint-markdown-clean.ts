// TS port of app/skills/lint_markdown_clean.py — forbidden internal-
// pipeline tokens in user-facing markdown (design/sourcedata-layout.md
// §Naming hygiene + the ADR-002 anti-inertia vocabulary).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DAILY_NEWS_REL, FP_REL, LOCALES } from '../world-paths.ts';

// Each entry: [human label, regex]. The 'g' flag is added at scan time;
// 'i'/'m' mirror the oracle's re.IGNORECASE / re.MULTILINE.
const FORBIDDEN: Array<[string, RegExp]> = [
  ['plain_language', /\bplain_language\b/i],
  ['JTBD', /\bJTBD\b/],
  ['legacy stream-letter label', /\bStream\s+[A-FJK]\b/],
  ['Reasoning trace', /\bReasoning trace\b/i],
  ['Pred ID #N', /\bPred(?:iction)?\s*ID\s*#\d+/i],
  ['Need ID #N', /\bNeed\s*ID\s*#\d+/i],
  ['Bridge ID #N', /\bBridge\s*ID\s*#\d+/i],
  ['prediction.<hash>', /\bprediction\.[0-9a-f]{8,}\b/],
  ['need.<hash>', /\bneed\.[0-9a-f]{8,}\b/],
  ['**Summary:** parser anchor', /\*\*Summary\s*:\s*\*\*/],
  ['**Bridge (...):** parser anchor', /\*\*Bridge\s*\([^)]*\)\s*:\s*\*\*/],
  ['Coherence N/5', /\bCoherence\s+\d\/5\b/i],
  ['Remaining gap:', /\bRemaining\s+gap\s*:/i],
  ['- because: bullet key', /^\s*-\s+because\s*:/m],
  ['- given: bullet key', /^\s*-\s+given\s*:/m],
  ['- so_that: bullet key', /^\s*-\s+so_that\s*:/m],
  ['- landing: bullet key', /^\s*-\s+landing\s*:/m],
  ['- plain_language: bullet key', /^\s*-\s+plain_language\s*:/m],
  // Detector, not stripper: the canonical strip list lives in
  // src/export/prefix-tokens.json (P8); these stay an independent subset.
  ['(Tech)/(Business)/(Mix) scope prefix',
    /\((?:Tech|Non-Tech|Non-tech|Business|Biz|Mix|Technical|Non-Technical|Technology|Tecnolog[íi]a|Tec|No-Tec|T[ée]cnico|Negocio|Teknikal|Hindi-Teknikal|Negosyo|Halong)\)/],
  ['（技術）/（ビジネス）scope prefix',
    /（(?:技術|非技術|テクノロジー|非テクノロジー|ビジネス|非ビジネス|ビジ|ミックス)）/],
  ['day-N storyline numbering',
    /\bday-(?:\d+|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)(?:-(?:one|two|three|four|five|six|seven|eight|nine))?\b/],
  ['aging vocabulary',
    /\b(?:weekend|doubly|triply|quadruply|quintuply|sextuply)[\s-](?:weekend[\s-])?aged\b/i],
  ['N-day-old artifact filler',
    /\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)[\s-]day[\s-]old\s+artifact\b/i],
  ['holiday-equivalent day filler',
    /\bholiday[\s-]equivalent\s+(?:day|operating\s+day|days)\b/i],
];

export interface LintHit { label: string; line: number; snippet: string }

export function scanText(text: string): LintHit[] {
  const hits: LintHit[] = [];
  for (const [label, pattern] of FORBIDDEN) {
    const re = new RegExp(pattern.source, pattern.flags + 'g');
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0;
      const line = (text.slice(0, start).match(/\n/g) ?? []).length + 1;
      const lineStart = text.lastIndexOf('\n', start - 1) + 1;
      let lineEnd = text.indexOf('\n', start + m[0].length);
      if (lineEnd === -1) lineEnd = text.length;
      let snippet = text.slice(lineStart, lineEnd).trim();
      if (snippet.length > 120) snippet = snippet.slice(0, 117) + '...';
      hits.push({ label, line, snippet });
    }
  }
  return hits;
}

/** The day's user-facing markdown files, over the FULL render set
 * ('en' + the effective non-EN set; default = the universe). */
export function datePaths(
  publishRoot: string, dateIso: string, locales: readonly string[] = LOCALES,
): string[] {
  const compact = dateIso.replaceAll('-', '');
  const out: string[] = [];
  for (const locale of locales) {
    out.push(join(publishRoot, DAILY_NEWS_REL, locale, `news-${compact}.md`));
    out.push(join(publishRoot, FP_REL, locale, `future-prediction-${compact}.md`));
  }
  return out.filter(p => existsSync(p));
}

export interface LintResult { exit: number; lines: string[] }

export function lintPaths(paths: string[]): LintResult {
  const lines: string[] = [];
  if (paths.length === 0) {
    lines.push('OK lint-markdown-clean: no files to check');
    return { exit: 0, lines };
  }
  let failed = false;
  for (const path of paths) {
    const hits = scanText(readFileSync(path, 'utf8'));
    if (hits.length) {
      failed = true;
      lines.push(`FAIL ${path}: ${hits.length} forbidden-token hit(s)`);
      for (const h of hits) {
        lines.push(`  - line ${h.line}: ${h.label}`);
        if (h.snippet) lines.push(`    ${h.snippet}`);
      }
    } else {
      lines.push(`OK ${path}`);
    }
  }
  if (failed) return { exit: 1, lines };
  lines.push(`OK lint-markdown-clean: ${paths.length} file(s) clean`);
  return { exit: 0, lines };
}
