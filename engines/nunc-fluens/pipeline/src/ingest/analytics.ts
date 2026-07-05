// TS port of app/src/analytics/{scoring.py, windows.py} — pure functions.
// Operand order mirrors the oracle so IEEE-754 results are bit-identical.

export const NEW_SIGNAL_SATURATION = 3.0;
export const CONTINUING_SIGNAL_SATURATION = 5.0;

export function clamp(value: number, lo = 0.0, hi = 1.0): number {
  if (value < lo) return lo;
  if (value > hi) return hi;
  return value;
}

export function normalizeRelevance(relevance: number | null | undefined): number {
  if (relevance === null || relevance === undefined) return 0.0;
  const r = Math.max(1, Math.min(5, Math.trunc(relevance)));
  return r / 5.0;
}

export function newSignalFromSum(totalNewRelevance: number): number {
  if (totalNewRelevance <= 0) return 0.0;
  return clamp(totalNewRelevance / NEW_SIGNAL_SATURATION, 0.0, 1.0);
}

export function continuingSignalFromSum(totalContRelevance: number): number {
  if (totalContRelevance <= 0) return 0.0;
  return clamp(totalContRelevance / CONTINUING_SIGNAL_SATURATION, 0.0, 1.0);
}

export function attentionScore(newSignal: number, continuingSignal: number): number {
  return clamp(newSignal + 0.5 * continuingSignal, 0.0, 1.0);
}

export function realizationScore(meanNew: number, meanCont: number): number {
  return clamp(0.65 * meanNew + 0.35 * meanCont, 0.0, 1.0);
}

export function grassLevel(attention: number): number {
  if (attention <= 0.05) return 0;
  if (attention <= 0.25) return 1;
  if (attention <= 0.50) return 2;
  if (attention <= 0.75) return 3;
  return 4;
}

export function themeStatus(attention: number, realization: number, firstSeen = false): string {
  if (firstSeen && attention >= 0.5) return 'new';
  if (attention >= 0.5 && realization >= 0.5) return 'active';
  if (attention >= 0.3) return 'continuing';
  return 'dormant';
}

export function predictionStatus(realization: number): string {
  if (realization >= 0.70) return 'supported';
  if (realization >= 0.40) return 'weakly_supported';
  return 'no_signal';
}

// --- windows.py -------------------------------------------------------

export const WINDOWS: ReadonlyArray<readonly [string, number]> = [
  ['7d', 7], ['30d', 30], ['90d', 90],
];

/** Dates as ISO strings; day arithmetic via UTC epoch-days. */
export function addDaysIso(dateIso: string, days: number): string {
  const t = Date.parse(dateIso + 'T12:00:00Z') + days * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

export function windowRange(latestIso: string, days: number): [string, string] {
  return [addDaysIso(latestIso, -(days - 1)), latestIso];
}
