// nunjucks environment mirroring the oracle's Jinja2 setup
// (autoescape=False, keep_trailing_newline=True, trim_blocks=False,
// lstrip_blocks=False — nunjucks keeps trailing newlines natively and
// trims nothing by default). The templates are the .j2 files reused
// verbatim (owner decision C2).
import nunjucks from 'nunjucks';
import { join } from 'node:path';

const TEMPLATE_DIR = join(import.meta.dirname, '..', '..', 'templates');

/** Python-splitlines semantics: universal newlines, and a trailing
 * newline does not produce a final empty element. */
export function pySplitLines(text: string): string[] {
  const lines = text.split(/\r\n|\r|\n/);
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function renderCitations(citations: unknown): string {
  if (!citations || !Array.isArray(citations) || citations.length === 0) return '';
  return citations.map((c) => {
    const label = c && typeof c === 'object' ? (c as Record<string, unknown>).label ?? '' : '';
    const url = c && typeof c === 'object' ? (c as Record<string, unknown>).url ?? '' : '';
    return `[${label}](${url})`;
  }).join(', ');
}

function indentBlock(text: unknown, n: number): string {
  if (!text) return '';
  const pad = ' '.repeat(n);
  const lines = pySplitLines(String(text));
  if (lines.length === 0) return '';
  // Oracle wart kept on purpose: `lines[0] + "\n" + "\n".join(...)`
  // appends the "\n" even when there is only one line, so a single-line
  // body renders with a trailing newline (which the template's own
  // newline then turns into the blank line the goldens carry).
  return lines[0] + '\n' + lines.slice(1).map(l => pad + l).join('\n');
}

function tableCell(text: unknown): string {
  if (text === null || text === undefined) return '';
  return String(text).replaceAll('\n', ' ').replaceAll('|', '\\|').trim();
}

function stripLeadEmdash(text: unknown): string {
  if (!text) return '';
  let s = String(text).replace(/^\s+/, '');
  if (s.startsWith('— ')) s = s.slice(2).replace(/^\s+/, '');
  else if (s.startsWith('—')) s = s.slice(1).replace(/^\s+/, '');
  return s.replace(/—(\s*—)+/g, '—');
}

export function buildEnv(): nunjucks.Environment {
  const env = new nunjucks.Environment(
    new nunjucks.FileSystemLoader(TEMPLATE_DIR),
    { autoescape: false, trimBlocks: false, lstripBlocks: false },
  );
  env.addFilter('render_citations', renderCitations);
  env.addFilter('indent_block', indentBlock);
  env.addFilter('table_cell', tableCell);
  env.addFilter('strip_lead_emdash', stripLeadEmdash);
  return env;
}

/** Post-render normalization shared by both renderers (line endings,
 * >2 blank-line runs, trailing newline). */
export function normalizeRendered(rendered: string): string {
  let out = rendered.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
  while (out.includes('\n\n\n\n')) out = out.replaceAll('\n\n\n\n', '\n\n\n');
  if (!out.endsWith('\n')) out += '\n';
  return out;
}

/** Jinja2 truthiness shim: nunjucks `if` uses JS truthiness, where an
 * empty array is TRUE — Jinja2 treats it as false. The templates guard
 * citation lists with `{% if x.citations %}`, so empty lists must become
 * null before they reach nunjucks or an extra space renders. */
export function emptyListToNull<T>(arr: T[]): T[] | null {
  return arr.length === 0 ? null : arr;
}
