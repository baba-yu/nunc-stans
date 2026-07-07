// Fuzzy prediction-summary matching ported from app/src/ingest.py.
// The oracle's semantic phase (fastembed) is deliberately NOT ported:
// the capture environment has no fastembed, so the goldens are
// LCS-only, and the manifest pins that constraint.

const MD_NOISE_RE = /[*`_~|>[\]()"'“”‘’「」『』【】〈〉《》〔〕]+/g;
const SEP_RE = /[\s　\-–—×xX+,、。!?！？]+/g;

export function fuzzyNorm(s: string): string {
  if (!s) return '';
  let out = s.normalize('NFKC');
  out = out.replace(MD_NOISE_RE, ' ');
  out = out.replace(SEP_RE, ' ');
  return out.trim().toLowerCase();
}

/** Longest common substring length (SequenceMatcher.find_longest_match
 * with autojunk=False reduces to this for size purposes). Rolling-array
 * DP, O(len(a)*len(b)). */
export function longestCommonSubstring(a: string, b: string): number {
  if (!a || !b) return 0;
  let prev = new Int32Array(b.length + 1);
  let cur = new Int32Array(b.length + 1);
  let best = 0;
  for (let i = 1; i <= a.length; i++) {
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j++) {
      if (ca === b.charCodeAt(j - 1)) {
        const v = prev[j - 1] + 1;
        cur[j] = v;
        if (v > best) best = v;
      } else {
        cur[j] = 0;
      }
    }
    [prev, cur] = [cur, prev];
    cur.fill(0);
  }
  return best;
}

/** (ratio, lcs_size): a 12+ char shared block saturates ratio to 1.0;
 * otherwise ratio = lcs / len(shorter). */
export function fuzzyMatchWithSize(a: string, b: string): [number, number] {
  const na = fuzzyNorm(a);
  const nb = fuzzyNorm(b);
  if (!na || !nb) return [0, 0];
  const size = longestCommonSubstring(na, nb);
  if (size >= 12) return [1, size];
  const shorter = Math.min(na.length, nb.length);
  if (shorter === 0) return [0, size];
  return [size / shorter, size];
}
