// Ports of the news_parser helpers the export layer uses: BOLD_RE
// bold-hint extraction, scope-prefix stripping, and the clause-split
// short-label derivation.

export const BOLD_RE = /\*\*([^*]+)\*\*/;

const PREFIX_TOKENS = [
  // English
  'tech', 'non-tech', 'non tech', 'nontech',
  'non-technical', 'non technical', 'nontechnical',
  'technical', 'technology',
  'business', 'biz', 'mix',
  // Japanese
  '技術', '非技術', '非-技術', '非 技術',
  'テクノロジー', '非テクノロジー',
  'ビジネス', '非ビジネス', 'ビジ', 'ミックス',
  // Spanish
  'tecnología', 'tecnologia',
  'no-tecnología', 'no-tecnologia',
  'no tecnología', 'no tecnologia',
  'tec', 'no-tec', 'no tec',
  'técnico', 'tecnico',
  'no-técnico', 'no-tecnico', 'no técnico', 'no tecnico',
  'negocio', 'no-negocio',
  // Filipino
  'teknikal', 'hindi-teknikal', 'hindi teknikal',
  'negosyo', 'halo', 'halong',
];

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
