// Shared low-level ports from app/src/ingest.py + friends: hashing,
// timestamps, URL canonicalization, and Python-json.dumps-compatible
// serialization (separator spacing + ensure_ascii matter because the
// strings land in DB columns the dump compares byte-wise).
import { createHash } from 'node:crypto';

export function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function sha1Hex(text: string): string {
  return createHash('sha1').update(text, 'utf8').digest('hex');
}

/** ingest.py `_hash_id`: sha1 of parts joined with "||", 16 hex chars. */
export function hashId(prefix: string, ...parts: string[]): string {
  return `${prefix}.${sha1Hex(parts.join('||')).slice(0, 16)}`;
}

/** extract_needs.py `_hash_id`: parts joined with a SINGLE "|". */
export function needHashId(prefix: string, ...parts: string[]): string {
  return `${prefix}.${sha1Hex(parts.join('|')).slice(0, 16)}`;
}

/** ingest_sourcedata `_chain_id` / `_relation_id`: single-"|" join, full sha1 sliced. */
export function chainId(sourcePid: string, downstreamPid: string, via: string | null): string {
  return `chain.${sha1Hex([sourcePid || '', downstreamPid || '', via || ''].join('|')).slice(0, 16)}`;
}

export function relationId(a: string, b: string, relationType: string): string {
  const [x, y] = [a || '', b || ''].sort();
  return `relation.${sha1Hex([x, y, relationType || ''].join('|')).slice(0, 16)}`;
}

export function canonicalizeUrl(url: string): string {
  let u = url.trim();
  const hash = u.indexOf('#');
  if (hash !== -1) u = u.slice(0, hash);
  return u.replace(/\/+$/, '');
}

/** Python json.dumps compatible: ", " / ": " separators; ensure_ascii
 * escapes every char > 0x7E as \uXXXX (astral chars as surrogate pairs,
 * which JS strings already are). */
export function pyJsonDumps(v: unknown, ensureAscii = true): string {
  const enc = (s: string): string => {
    let out = JSON.stringify(s);
    if (ensureAscii)
      out = out.replace(/[-￿]/g,
        ch => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'));
    return out;
  };
  const walk = (x: unknown): string => {
    if (x === null || x === undefined) return 'null';
    if (typeof x === 'string') return enc(x);
    if (typeof x === 'number') return Number.isInteger(x) ? String(x) : String(x);
    if (typeof x === 'boolean') return x ? 'true' : 'false';
    if (Array.isArray(x)) return `[${x.map(walk).join(', ')}]`;
    return `{${Object.entries(x as Record<string, unknown>)
      .map(([k, val]) => `${enc(k)}: ${walk(val)}`).join(', ')}}`;
  };
  return walk(v);
}
