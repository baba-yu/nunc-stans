// TS port of app/skills/citation_restriction_check.py — denylist gate
// on [label](url) citations in a draft file + the UNCLASSIFIED-host
// review ledger.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import type { GateResult } from './post-update-validation.ts';

const URL_RE = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;

const HOST_BUCKETS = [
  'denylist', 'paywall_short_quote_only', 'unconfirmed_denylist', 'requires_attribution',
] as const;

export interface Policy {
  denylist: Set<string>;
  paywall_short_quote_only: Set<string>;
  unconfirmed_denylist: Set<string>;
  requires_attribution: Set<string>;
  parent_groups: Array<{ parent: string; members: Set<string> }>;
}

export function parsePolicy(policyPath: string): Policy {
  const out: Policy = {
    denylist: new Set(), paywall_short_quote_only: new Set(),
    unconfirmed_denylist: new Set(), requires_attribution: new Set(),
    parent_groups: [],
  };
  if (!existsSync(policyPath)) return out;
  const text = readFileSync(policyPath, 'utf8');
  let current: string | null = null;
  let pgCurrent: { parent: string; members: Set<string> } | null = null;
  for (const raw of text.split('\n')) {
    const s = raw.trim();
    if (s.startsWith('## ')) {
      const name = s.slice(3).trim();
      current = (HOST_BUCKETS as readonly string[]).includes(name) || name === 'parent_groups'
        ? name : null;
      pgCurrent = null;
      continue;
    }
    if (!current) continue;
    if (current === 'parent_groups' && s.startsWith('### ')) {
      pgCurrent = { parent: s.slice(4).trim(), members: new Set() };
      out.parent_groups.push(pgCurrent);
      continue;
    }
    if (!s || s.startsWith('#')) continue;
    if ((HOST_BUCKETS as readonly string[]).includes(current)) {
      const bucket = out[current as typeof HOST_BUCKETS[number]];
      if (!(s.startsWith('|') && s.endsWith('|'))) {
        if (current === 'requires_attribution' && s.startsWith('- '))
          bucket.add(s.slice(2).trim().toLowerCase());
        continue;
      }
      const cells = s.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
      if (!cells.length) continue;
      const first = cells[0].toLowerCase();
      if (!first || [...first].every(ch => '- :'.includes(ch)) || first === 'host' || first === 'site')
        continue;
      bucket.add(first);
    } else if (current === 'parent_groups' && pgCurrent !== null) {
      if (s.startsWith('- ')) pgCurrent.members.add(s.slice(2).trim().toLowerCase());
    }
  }
  return out;
}

function matchesParent(host: string, parentGroups: Policy['parent_groups']): string | null {
  for (const grp of parentGroups)
    for (const member of grp.members)
      if (host === member || host.endsWith('.' + member)) return grp.parent;
  return null;
}

export function classifyHost(host: string, policy: Policy): string {
  if (policy.denylist.has(host)) return 'denylist';
  if (matchesParent(host, policy.parent_groups) !== null) return 'parent_inherited';
  if (policy.unconfirmed_denylist.has(host)) return 'unconfirmed_denylist';
  if (policy.paywall_short_quote_only.has(host)) return 'paywall_short_quote_only';
  if (policy.requires_attribution.has(host)) return 'requires_attribution';
  return 'unclassified';
}

const LEDGER_HEADER = `# Citation policy review queue

Auto-maintained by \`app/skills/citation_restriction_check.py --unclassified-out\`.
Each daily run upserts every UNCLASSIFIED host (no ToS-based classification yet) sighted in \`data/daily-news/<L>/news-*.md\` and \`data/future-prediction/<L>/future-prediction-*.md\`. Counts include all sightings since the host first showed up; first_seen + last_seen are ISO dates (the dated draft file's date).

A human reviewer reads each entry's ToS, then either:
- promotes the host into \`data/reference/citation-restrictions.md\` (denylist / parent_groups / unconfirmed_denylist / paywall_short_quote_only / requires_attribution), or
- leaves it here under default-allow.

When a host is promoted, **delete its row from the table below** so this ledger stays a queue (not a denormalized cache).

Sorted by \`count\` descending, then host alphabetical.

| host | count | first_seen | last_seen | sample_label |
|---|---|---|---|---|
`;

interface LedgerRow { count: number; first: string; last: string; label: string }

function parseLedger(ledgerPath: string): Map<string, LedgerRow> {
  const rows = new Map<string, LedgerRow>();
  if (!existsSync(ledgerPath)) return rows;
  let inTable = false;
  for (const raw of readFileSync(ledgerPath, 'utf8').split('\n')) {
    const s = raw.trim();
    if (s.startsWith('| host |')) { inTable = true; continue; }
    if (inTable && s.startsWith('|---')) continue;
    if (!inTable) continue;
    if (!(s.startsWith('|') && s.endsWith('|'))) { inTable = false; continue; }
    const cells = s.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
    if (cells.length < 5) continue;
    const count = Number(cells[1]);
    if (!Number.isInteger(count)) continue;
    rows.set(cells[0].toLowerCase(), { count, first: cells[2], last: cells[3], label: cells[4] });
  }
  return rows;
}

function writeLedger(ledgerPath: string, rows: Map<string, LedgerRow>): void {
  const sorted = [...rows.entries()]
    .sort((a, b) => b[1].count - a[1].count || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const body = sorted.map(([host, e]) =>
    `| ${host} | ${e.count} | ${e.first} | ${e.last} | ${(e.label ?? '').replaceAll('|', '\\|')} |`);
  mkdirSync(dirname(ledgerPath), { recursive: true });
  writeFileSync(ledgerPath, LEDGER_HEADER + body.join('\n') + '\n', 'utf8');
}

function upsertLedger(ledgerPath: string, sightings: Map<string, LedgerRow>): [number, number] {
  const existing = parseLedger(ledgerPath);
  let added = 0, updated = 0;
  for (const [rawHost, e] of sightings) {
    const host = rawHost.toLowerCase();
    const cur = existing.get(host);
    if (cur !== undefined) {
      cur.count += e.count;
      if (e.first < cur.first || !cur.first) cur.first = e.first;
      if (e.last > cur.last || !cur.last) cur.last = e.last;
      if (e.label && !cur.label) cur.label = e.label;
      updated += 1;
    } else {
      existing.set(host, { ...e });
      added += 1;
    }
  }
  writeLedger(ledgerPath, existing);
  return [added, updated];
}

function draftDate(draftPath: string, todayIso: string): string {
  const m = /-(\d{4})(\d{2})(\d{2})\.md$/.exec(basename(draftPath));
  return m ? `${m[1]}-${m[2]}-${m[3]}` : todayIso;
}

export function citationCheck(args: {
  draft: string; policyFile: string; unclassifiedOut?: string | null; todayIso: string;
}): GateResult {
  const lines: string[] = [];
  if (!existsSync(args.draft))
    return { exit: 2, lines, stderr: `FAIL draft not found: ${args.draft}\n` };
  if (!existsSync(args.policyFile)) {
    lines.push(`TODO: ${args.policyFile} missing — restriction check skipped`);
    return { exit: 0, lines };
  }
  const policy = parsePolicy(args.policyFile);
  const text = readFileSync(args.draft, 'utf8');
  const hits: Record<string, Array<[string, string, string, string]>> = {
    RESTRICT: [], RESTRICT_PARENT: [], RESTRICT_UNCONFIRMED: [],
    CAUTION_PAYWALL: [], ATTRIBUTION_NOTE: [],
  };
  const sightings = new Map<string, LedgerRow>();
  const date = draftDate(args.draft, args.todayIso);
  for (const m of text.matchAll(URL_RE)) {
    const url = m[2].replace(/[).,;:]+$/, '');
    let host = '';
    try { host = new URL(url).hostname.toLowerCase(); } catch { /* mirror empty host */ }
    host = host.replace(/^www\./, '');
    if (!host) continue;
    const verdict = classifyHost(host, policy);
    if (verdict === 'denylist') hits.RESTRICT.push([host, url, m[1], '']);
    else if (verdict === 'parent_inherited')
      hits.RESTRICT_PARENT.push([host, url, m[1], matchesParent(host, policy.parent_groups) ?? '?']);
    else if (verdict === 'unconfirmed_denylist') hits.RESTRICT_UNCONFIRMED.push([host, url, m[1], '']);
    else if (verdict === 'paywall_short_quote_only') hits.CAUTION_PAYWALL.push([host, url, m[1], '']);
    else if (verdict === 'requires_attribution') hits.ATTRIBUTION_NOTE.push([host, url, m[1], '']);
    else {
      let e = sightings.get(host);
      if (e === undefined) {
        e = { count: 0, first: date, last: date, label: '' };
        sightings.set(host, e);
      }
      e.count += 1;
      if (date < e.first) e.first = date;
      if (date > e.last) e.last = date;
      if (!e.label) e.label = m[1].slice(0, 60);
    }
  }

  let fail = false;
  if (hits.RESTRICT.length) {
    fail = true;
    lines.push('FAIL reference restriction (denylist):');
    for (const [host, url, label] of hits.RESTRICT)
      lines.push(`  RESTRICT ${host}  (${label})  ${url}`);
  }
  if (hits.RESTRICT_PARENT.length) {
    fail = true;
    lines.push('FAIL reference restriction (parent-inherited):');
    for (const [host, url, label, parent] of hits.RESTRICT_PARENT)
      lines.push(`  RESTRICT(parent=${parent}) ${host}  (${label})  ${url}`);
  }
  if (hits.RESTRICT_UNCONFIRMED.length) {
    fail = true;
    lines.push('FAIL reference restriction (ToS unconfirmed -> safe-side):');
    for (const [host, url, label] of hits.RESTRICT_UNCONFIRMED)
      lines.push(`  RESTRICT(unconfirmed) ${host}  (${label})  ${url}`);
  }
  if (fail)
    lines.push('Substitute each RESTRICT citation with an alternative source for the same factual claim, or drop the bullet. Re-run this check.');
  for (const [host, url] of hits.CAUTION_PAYWALL)
    lines.push(`CAUTION (paywalled, paraphrase only): ${host}  ${url}`);
  for (const [host] of hits.ATTRIBUTION_NOTE)
    lines.push(`NOTE (attribution required, format already enforces): ${host}`);

  if (sightings.size) {
    lines.push('UNCLASSIFIED hosts seen in this draft (review and decide if any belong on the lists):');
    for (const host of [...sightings.keys()].sort()) lines.push(`  - ${host}`);
  }
  if (args.unclassifiedOut && sightings.size) {
    const [added, upd] = upsertLedger(args.unclassifiedOut, sightings);
    lines.push(`ledger ${args.unclassifiedOut}: +${added} new, ~${upd} updated`);
  }
  if (fail) return { exit: 1, lines };
  lines.push(`OK reference restriction: ${args.draft}`);
  return { exit: 0, lines };
}
