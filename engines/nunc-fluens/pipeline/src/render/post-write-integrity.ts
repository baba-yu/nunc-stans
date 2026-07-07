// TS port of app/skills/post_write_integrity.py — shared post-write
// gate: NUL-tail repair (stage 1) + kind-specific structural
// completeness (stage 2). Message strings mirror the oracle.
//
// Regex notes: Python \Z (absolute end) becomes the JS lookahead
// (?![\s\S]); Python re.MULTILINE $ and JS m-flag $ agree (both match
// before a trailing newline).
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

const REPAIR_MEMO = new Map<string, number>();

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function count(text: string, needle: string): number {
  let n = 0, i = 0;
  while ((i = text.indexOf(needle, i)) !== -1) { n++; i += needle.length; }
  return n;
}

function pipes(line: string): number {
  return count(line, '|');
}

// ---------------------------------------------------------------------------
// Stage 1: NUL-tail repair
// ---------------------------------------------------------------------------

function bridgeIntegrity(path: string): string {
  if (!existsSync(path)) return `FAIL missing: ${path}`;
  const data = readFileSync(path);
  if (data.length === 0) return `FAIL empty: ${path}`;
  const tail = data.subarray(Math.max(0, data.length - 512));
  if (data[data.length - 1] === 0 || tail.includes(0)) {
    let end = data.length;
    while (end > 0 && data[end - 1] === 0) end--;
    const fixed = data.subarray(0, end);
    const key = resolve(path);
    REPAIR_MEMO.set(key, (REPAIR_MEMO.get(key) ?? 0) + 1);
    if ((REPAIR_MEMO.get(key) ?? 0) >= 2)
      return `FAIL repair-twice for ${path} — bridge degraded; aborting`;
    const tmp = join(dirname(path), `${basename(path)}.${process.pid}.tmp`);
    try {
      writeFileSync(tmp, fixed);
      renameSync(tmp, path);
    } catch (err) {
      rmSync(tmp, { force: true });
      throw err;
    }
    return `REPAIRED ${path}: stripped ${data.length - fixed.length} trailing NUL byte(s)`;
  }
  return `OK ${path} (${data.length} bytes)`;
}

// ---------------------------------------------------------------------------
// Stage 2: structural completeness, by kind
// ---------------------------------------------------------------------------

function commonTailChecks(text: string, errors: string[], tailLen = 200): void {
  if (!text.endsWith('\n'))
    errors.push('file does not end with newline (likely truncated mid-token)');
  const tail = text.replace(/\s+$/, '').slice(-tailLen);
  if (/\[[^\]\n]*$/.test(tail) || /\([^)\n]*$/.test(tail))
    errors.push('trailing markdown link looks unclosed (truncated mid-link)');
  if (count(text, '**') % 2 !== 0)
    errors.push('unbalanced ** bold markers in document (truncated mid-bold)');
}

function checkNews(text: string): string[] {
  const errors: string[] = [];
  for (const h of ['## Headlines', '## Future', '## Change Log', '## News'])
    if (!new RegExp(`^${escapeRe(h)}\\s*$`, 'm').test(text))
      errors.push(`missing H2 section: '${h}'`);
  const fut = /^## Future\s*$(.*?)(?=^##\s|(?![\s\S]))/ms.exec(text);
  if (fut) {
    const items = fut[1].match(/^\s*\d+\.\s+\S/gm) ?? [];
    if (items.length < 3)
      errors.push(`## Future has only ${items.length} numbered item(s); spec requires 3`);
  } else {
    errors.push('could not locate ## Future body for item count check');
  }
  commonTailChecks(text, errors);
  return errors;
}

const FP_TABLE_HEADER = String.raw`^##\s+(?:Checking Predictions Against Reality|Validation findings)\s*$`;

function checkFuturePrediction(text: string): string[] {
  const errors: string[] = [];
  if (!new RegExp(FP_TABLE_HEADER, 'm').test(text))
    errors.push(
      "missing H2 section: '## Checking Predictions Against Reality' "
      + "or '## Validation findings'");
  const sec = new RegExp(`${FP_TABLE_HEADER}(.*?)(?=^##\\s|(?![\\s\\S]))`, 'ms').exec(text);
  if (sec) {
    const body = sec[1];
    const rows = body.split('\n').filter(ln => ln.trim().startsWith('|'));
    if (rows.length >= 2) {
      const headerPipes = pipes(rows[0]);
      for (let i = 0; i < rows.length; i++) {
        if (pipes(rows[i]) !== headerPipes) {
          errors.push(`validation table row ${i} has ${pipes(rows[i])} pipes, expected ${headerPipes}`);
          break;
        }
      }
    }
    const bodyLines = body.split('\n');
    let lastPipe = -1;
    bodyLines.forEach((ln, i) => { if (ln.trim().startsWith('|')) lastPipe = i; });
    if (lastPipe >= 0 && lastPipe === bodyLines.length - 1)
      errors.push('validation table ends at section EOF without closing blank line (likely truncated)');
  } else {
    errors.push(
      "could not locate '## Checking Predictions Against Reality' "
      + "or '## Validation findings' body");
  }
  commonTailChecks(text, errors);
  return errors;
}

function checkDormant(text: string): string[] {
  const errors: string[] = [];
  if (!/^# Dormant pool — week ending \d{4}-\d{2}-\d{2}\s*$/m.test(text))
    errors.push('missing top-level dormant pool header');
  if (!/^## Tier: Dormant/m.test(text))
    errors.push('missing `## Tier: Dormant …` header');
  const sections = [...text.matchAll(/^## Tier:.*?\n(.*?)(?=^## Tier:|(?![\s\S]))/gms)];
  sections.forEach((m, i) => {
    const rows = m[1].split('\n').filter(ln => ln.trim().startsWith('|'));
    if (rows.length === 0) { errors.push(`tier section ${i}: no markdown table at all`); return; }
    if (rows.length < 2) {
      errors.push(`tier section ${i}: table missing separator row (header without |---| line)`);
      return;
    }
    const expected = pipes(rows[0]);
    for (let j = 0; j < rows.length; j++) {
      if (pipes(rows[j]) !== expected) {
        errors.push(`tier section ${i} row ${j}: ${pipes(rows[j])} pipes, expected ${expected}`);
        break;
      }
    }
  });
  if (!text.endsWith('\n'))
    errors.push('file does not end with newline (likely truncated mid-token)');
  const tail = text.replace(/\s+$/, '').slice(-200);
  if (/\|\s*[^|\n]*$/.test(tail) && !tail.replace(/\s+$/, '').endsWith('|'))
    errors.push('tail looks like an unclosed table row (no trailing pipe)');
  if (count(text, '**') % 2 !== 0)
    errors.push('unbalanced ** bold markers in document');
  return errors;
}

function checkThemeReview(text: string): string[] {
  const errors: string[] = [];
  for (const h of ['## Empty / underused themes', '## Overpopulated themes',
    '## Theme candidates', '## Recommended actions'])
    if (!new RegExp(`^${escapeRe(h)}`, 'm').test(text))
      errors.push(`missing H2 section starting with: '${h}'`);
  const ra = /^## Recommended actions\s*$(.*?)(?=^##\s|(?![\s\S]))/ms.exec(text);
  if (ra) {
    const items = ra[1].match(/^\s*\d+\.\s+\S/gm) ?? [];
    if (items.length > 5)
      errors.push(`## Recommended actions has ${items.length} items; spec caps at 5`);
    if (items.length) {
      const parts = ra[1].split(/^\s*\d+\.\s+/m);
      const last = parts[parts.length - 1].trim();
      if (last.length < 20 || /[([→]\s*$/.test(last))
        errors.push(`## Recommended actions: last item looks truncated: '${last}'`);
    }
  } else {
    errors.push('could not locate ## Recommended actions body');
  }
  commonTailChecks(text, errors, 300);
  return errors;
}

function checkReadme(text: string): string[] {
  const errors: string[] = [];
  if (!/\n---\s*\n*(?![\s\S])/.test(text))
    errors.push('does not end with `---` separator (likely truncated mid-block)');
  const blocks = [...text.matchAll(
    /^## (\d{4}-\d{2}-\d{2})\s*$(.*?)(?=^## \d{4}-\d{2}-\d{2}\s*$|(?![\s\S]))/gms)];
  for (const [, date, body] of blocks) {
    if (!/^### News\s*$/m.test(body)) errors.push(`## ${date}: missing \`### News\``);
    if (!/^### Predictions check\s*$/m.test(body))
      errors.push(`## ${date}: missing \`### Predictions check\``);
    // The contract is the link TARGET (today's file under the right
    // tree), not the anchor text — live run 2026-07-07 (instance `news`)
    // produced a human label ("News report — …") for the correct target
    // and the old text-anchored regex failed the day.
    const newsBody = /^### News\s*$(.*?)(?=^###\s|(?![\s\S]))/ms.exec(body);
    if (newsBody && !/\[[^\]\n]+\]\(data\/daily-news\/[^)\s]+\/news-\d{8}\.md\)/.test(newsBody[1]))
      errors.push(`## ${date} ### News: missing terminating link to data/daily-news/<L>/news-….md`);
    const predBody =
      /^### Predictions check\s*$(.*?)(?=^###\s|^## \d{4}-\d{2}-\d{2}\s*$|(?![\s\S]))/ms.exec(body);
    if (predBody && !/\[[^\]\n]+\]\(data\/future-prediction\/[^)\s]+\/future-prediction-\d{8}\.md\)/.test(predBody[1]))
      errors.push(`## ${date} ### Predictions check: missing terminating link to data/future-prediction/<L>/future-prediction-….md`);
  }
  const tail = text.replace(/\s+$/, '').slice(-300);
  if (/\[[^\]\n]*$/.test(tail) || /\([^)\n]*$/.test(tail))
    errors.push('trailing markdown link looks unclosed (truncated mid-link)');
  if (count(text, '**') % 2 !== 0)
    errors.push('unbalanced ** bold markers in document (truncated mid-bold)');
  return errors;
}

function checkDashboardAsset(path: string, text: string): string[] {
  const errors: string[] = [];
  const name = basename(path);
  if (name === 'index.html' && !/<\/html>\s*$/.test(text))
    errors.push('missing closing </html>');
  else if (name === 'app.js' && !/\}\)\(\);?\s*$/.test(text))
    errors.push('missing trailing })(); IIFE marker');
  else if (name === 'styles.css' && !/\}\s*$/.test(text))
    errors.push('missing trailing } CSS rule terminator');
  return errors;
}

const CHECKERS: Record<string, (text: string) => string[]> = {
  'news': checkNews,
  'future-prediction': checkFuturePrediction,
  'dormant': checkDormant,
  'theme-review': checkThemeReview,
  'readme': checkReadme,
};

export type IntegrityKind =
  'news' | 'future-prediction' | 'dormant' | 'theme-review' | 'readme' | 'dashboard-asset';

function structuralCompleteness(path: string, kind: IntegrityKind): string[] {
  const text = readFileSync(path, 'utf8');
  if (kind === 'dashboard-asset') return checkDashboardAsset(path, text);
  const fn = CHECKERS[kind];
  if (!fn) return [`unknown kind: '${kind}'`];
  return fn(text);
}

/** Text-level structural check (no file involved) — used to validate
 * LLM output before it is ever written. dashboard-asset is path-based
 * and not supported here. */
export function structuralErrors(kind: Exclude<IntegrityKind, 'dashboard-asset'>, text: string): string[] {
  const fn = CHECKERS[kind];
  if (!fn) return [`unknown kind: '${kind}'`];
  return fn(text);
}

export interface IntegrityResult { exit: number; lines: string[] }

/** In-process equivalent of `python -m app.skills.post_write_integrity
 * --kind K --path P...`. Returns the exit code and the report lines. */
export function postWriteIntegrity(kind: IntegrityKind, paths: string[]): IntegrityResult {
  const lines: string[] = [];
  let failed = false;
  for (const path of paths) {
    const report = bridgeIntegrity(path);
    lines.push(report);
    if (report.startsWith('FAIL')) { failed = true; continue; }
    const errors = structuralCompleteness(path, kind);
    if (errors.length) {
      lines.push(`FAIL structural completeness: ${path}`);
      for (const e of errors) lines.push(`  - ${e}`);
      failed = true;
    } else {
      lines.push(`OK structural completeness: ${path}`);
    }
  }
  return { exit: failed ? 1 : 0, lines };
}
