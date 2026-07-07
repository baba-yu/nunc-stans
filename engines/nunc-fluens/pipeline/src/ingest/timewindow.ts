// TS port of app/src/timewindow.py — natural-language time expressions
// into (startIso, endIso) pairs, conservative (null, null) on ambiguity.
// Dates are handled as {y, m, d} triples to avoid timezone drift.

type Ymd = { y: number; m: number; d: number };

const MONTH: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};
const MONTH_PAT = Object.keys(MONTH).join('|');

const QUARTER_RE = /\bQ([1-4])\s*(20\d{2})\b|\b(20\d{2})\s*Q([1-4])\b/i;
const HALF_RE = /\bH([12])\s*(20\d{2})\b|\b(20\d{2})\s*H([12])\b/i;
const ISO_DATE_RE = /\b(20\d{2})-(\d{2})-(\d{2})\b/;
const LONG_DATE_RE = new RegExp(
  `\\b(${MONTH_PAT})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(20\\d{2})\\b`, 'i');
const DATE_RANGE_RE = new RegExp(
  `\\b(${MONTH_PAT})\\s+(\\d{1,2})\\s*[-–—]\\s*(\\d{1,2})(?:,)?\\s+(20\\d{2})\\b`, 'i');
const MOD_MONTH_RE = new RegExp(
  `\\b(early|mid|late)[\\s-](${MONTH_PAT})\\s+(20\\d{2})\\b`, 'i');
const MONTH_YEAR_RE = new RegExp(
  `\\b(${MONTH_PAT})\\s+(20\\d{2})\\b|\\b(20\\d{2})-(\\d{2})\\b(?!-)`, 'i');
const BY_PREFIX_RE = /\b(by|before|until|in)\s+/gi;
const RELATIVE_RE = /\b(?:within|in|over|across|the\s+next|the\s+coming|next|coming)\s*(?:~\s*)?(\d+)?\s*(quarters?|Qs?|months?|weeks?|years?|year)\b/i;
const NEXT_UNIT_RE = /\bnext\s+(quarter|month|week|year)\b/i;

function lastDay(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function iso(d: Ymd): string {
  return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
}

function valid(d: Ymd): boolean {
  return d.m >= 1 && d.m <= 12 && d.d >= 1 && d.d <= lastDay(d.y, d.m);
}

function addUnits(d: Ymd, n: number, unit: string): Ymd {
  const u = unit.toLowerCase().replace(/s$/, '');
  let months: number;
  if (u === 'q' || u === 'quarter') months = 3 * n;
  else if (u === 'month') months = n;
  else if (u === 'week') {
    const t = Date.UTC(d.y, d.m - 1, d.d) + n * 7 * 86400000;
    const nd = new Date(t);
    return { y: nd.getUTCFullYear(), m: nd.getUTCMonth() + 1, d: nd.getUTCDate() };
  } else if (u === 'year') months = 12 * n;
  else return d;
  const nm0 = d.m - 1 + months;
  const ny = d.y + Math.floor(nm0 / 12);
  const nm = ((nm0 % 12) + 12) % 12 + 1;
  return { y: ny, m: nm, d: Math.min(d.d, lastDay(ny, nm)) };
}

function resolveRelative(s: string, anchorIso: string): [string | null, string | null] {
  const parts = anchorIso?.split('-') ?? [];
  if (parts.length !== 3) return [null, null];
  const anchor: Ymd = { y: Number(parts[0]), m: Number(parts[1]), d: Number(parts[2]) };
  if (!Number.isInteger(anchor.y) || !Number.isInteger(anchor.m) || !Number.isInteger(anchor.d)
    || !valid(anchor)) return [null, null];
  let m = RELATIVE_RE.exec(s);
  if (m) {
    const n = m[1] ? parseInt(m[1], 10) : 1;
    return [iso(anchor), iso(addUnits(anchor, n, m[2]))];
  }
  m = NEXT_UNIT_RE.exec(s);
  if (m) return [iso(anchor), iso(addUnits(anchor, 1, m[1]))];
  return [null, null];
}

function quarterBounds(y: number, q: number): [Ymd, Ymd] {
  const sm = (q - 1) * 3 + 1;
  const em = sm + 2;
  return [{ y, m: sm, d: 1 }, { y, m: em, d: lastDay(y, em) }];
}

function halfBounds(y: number, h: number): [Ymd, Ymd] {
  return h === 1
    ? [{ y, m: 1, d: 1 }, { y, m: 6, d: 30 }]
    : [{ y, m: 7, d: 1 }, { y, m: 12, d: 31 }];
}

function monthBounds(y: number, m: number): [Ymd, Ymd] {
  return [{ y, m, d: 1 }, { y, m, d: lastDay(y, m) }];
}

function modifierBounds(y: number, m: number, modifier: string): [Ymd, Ymd] {
  const last = lastDay(y, m);
  switch (modifier.toLowerCase()) {
    case 'early': return [{ y, m, d: 1 }, { y, m, d: Math.min(10, last) }];
    case 'mid': return [{ y, m, d: 11 }, { y, m, d: Math.min(20, last) }];
    case 'late': return [{ y, m, d: 21 }, { y, m, d: last }];
    default: return monthBounds(y, m);
  }
}

/** Python date.fromisocalendar(year, week, 1) — the Monday of the ISO
 * week — as epoch ms, or null when the week is invalid for that year. */
function weeksInIsoYear(y: number): number {
  const p = (yy: number) =>
    (yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400)) % 7;
  return p(y) === 4 || p(y - 1) === 3 ? 53 : 52;
}

function isoWeekMonday(year: number, week: number): number | null {
  if (week < 1 || week > weeksInIsoYear(year)) return null;
  const jan4 = Date.UTC(year, 0, 4);
  const dow = (new Date(jan4).getUTCDay() + 6) % 7; // Mon=0
  const monday1 = jan4 - dow * 86400000;
  return monday1 + (week - 1) * 7 * 86400000;
}

/** Port of timewindow.parse_week_bucket: `%Y-%W` bucket → (Mon, Sun). */
export function parseWeekBucket(weekBucket: string): [string | null, string | null] {
  if (!weekBucket || !weekBucket.includes('-')) return [null, null];
  const dash = weekBucket.indexOf('-');
  const year = Number(weekBucket.slice(0, dash));
  const week = Number(weekBucket.slice(dash + 1));
  if (!Number.isInteger(year) || !Number.isInteger(week)) return [null, null];
  let monday = isoWeekMonday(year, Math.max(week, 1));
  if (monday === null) {
    // Fallback: approximate via day-of-year arithmetic (mirrors the
    // oracle's except-branch).
    const jan1 = Date.UTC(year, 0, 1);
    if (!Number.isFinite(jan1)) return [null, null];
    const wd = (new Date(jan1).getUTCDay() + 6) % 7; // Mon=0
    const offset = (7 - wd) % 7;
    monday = jan1 + (offset + (week - 1) * 7) * 86400000;
  }
  const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
  return [iso(monday), iso(monday + 6 * 86400000)];
}

export function parseTimeWindow(
  text: string, anchor?: string | null,
): [string | null, string | null] {
  if (!text) return [null, null];
  let s = text.trim();

  if (anchor) {
    const rel = resolveRelative(s, anchor);
    if (rel[0] !== null || rel[1] !== null) return rel;
  }

  s = s.replace(BY_PREFIX_RE, '');

  let m = DATE_RANGE_RE.exec(s);
  if (m) {
    const month = MONTH[m[1].toLowerCase()];
    const year = parseInt(m[4], 10);
    const a: Ymd = { y: year, m: month, d: parseInt(m[2], 10) };
    const b: Ymd = { y: year, m: month, d: parseInt(m[3], 10) };
    if (month && valid(a) && valid(b)) return [iso(a), iso(b)];
  }

  m = ISO_DATE_RE.exec(s);
  if (m) {
    const d: Ymd = { y: +m[1], m: +m[2], d: +m[3] };
    if (valid(d)) return [iso(d), iso(d)];
  }

  m = LONG_DATE_RE.exec(s);
  if (m) {
    const month = MONTH[m[1].toLowerCase()];
    const d: Ymd = { y: +m[3], m: month, d: +m[2] };
    if (month && valid(d)) return [iso(d), iso(d)];
  }

  m = QUARTER_RE.exec(s);
  if (m) {
    const q = m[1] ? +m[1] : +m[4];
    const year = m[1] ? +m[2] : +m[3];
    const [a, b] = quarterBounds(year, q);
    return [iso(a), iso(b)];
  }

  m = HALF_RE.exec(s);
  if (m) {
    const h = m[1] ? +m[1] : +m[4];
    const year = m[1] ? +m[2] : +m[3];
    const [a, b] = halfBounds(year, h);
    return [iso(a), iso(b)];
  }

  m = MOD_MONTH_RE.exec(s);
  if (m) {
    const month = MONTH[m[2].toLowerCase()];
    if (month) {
      const [a, b] = modifierBounds(+m[3], month, m[1]);
      return [iso(a), iso(b)];
    }
  }

  m = MONTH_YEAR_RE.exec(s);
  if (m) {
    let year: number, month: number;
    if (m[1]) { month = MONTH[m[1].toLowerCase()]; year = +m[2]; }
    else { year = +m[3]; month = +m[4]; }
    if (month >= 1 && month <= 12) {
      const [a, b] = monthBounds(year, month);
      return [iso(a), iso(b)];
    }
  }

  return [null, null];
}
