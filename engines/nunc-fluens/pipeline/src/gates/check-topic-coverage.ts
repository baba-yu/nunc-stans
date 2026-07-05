// TS port of app/skills/check_topic_coverage.py — the topic-coverage
// gate with its three modes (verification.json / legacy search_log /
// self-anchored heuristic fallback).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GateResult } from './post-update-validation.ts';

const SELF_ANCHORED: Array<[string, RegExp[]]> = [
  ['CVE update on score ≥ 8.0', [/\bCVE-\d{4}-\d+\b/i, /\bCVSS\b/]],
  ['LLM-related research and papers', [/arxiv\.org/i, /\bArXiv\s+[0-9]{4}\.[0-9]+/i]],
  ['Stock prices and corporate activity', [/\bNASDAQ:/, /\bNYSE:/]],
];

const ALL_TOPICS = [
  'LLM Workflow',
  'Multi-profiling for Local LLM (e.g. Multica)',
  'Agent Harness (OpenClaw, NemoClaw, Hermes Agents, etc.)',
  'Platform for Local LLM (vLLM, SGLang, etc.)',
  'Ecosystems for Local LLM Embedded System (Foundry Local, etc.)',
  'Local LLM Models',
  'Local LLM Optimization, Fine-tuning (Unsloth — every run)',
  'Ecosystems for LLM on PaaS (AWS Bedrock, Azure AI Foundry, etc.)',
  'AI Security',
  'CVE update on score ≥ 8.0',
  'Hardware',
  'Physical AI',
  'LLM-related research and papers',
  'Stock prices and corporate activity',
  'Bay Area / SV AI meet-up events',
  'Other standing-out topics',
];

const MANDATORY = new Set(['Local LLM Optimization, Fine-tuning (Unsloth — every run)']);
const NEWS_DRIVEN = new Set(['Multi-profiling for Local LLM (e.g. Multica)']);

function validateVerification(verificationPath: string): [number, string[]] {
  const log = JSON.parse(readFileSync(verificationPath, 'utf8'));
  const verifications = new Map<string, any>(
    (log.verifications ?? []).map((e: any) => [e.topic, e]));
  const findings: string[] = [];
  let exitCode = 0;
  let overreports = 0;
  let underreports = 0;

  for (const topic of ALL_TOPICS) {
    const entry = verifications.get(topic);
    const tag = MANDATORY.has(topic) ? ' [MANDATORY]'
      : NEWS_DRIVEN.has(topic) ? ' [news-driven]' : '';
    if (entry === undefined) {
      findings.push(`-- ${topic}${tag}: NOT IN verification.json (auditor didn't enumerate it)`);
      if (MANDATORY.has(topic)) exitCode = 1;
      continue;
    }
    const verdict = entry.semantic_verdict ?? 'ambiguous';
    const alignment = entry.search_log_alignment ?? 'unknown';
    const reason = entry.reason ?? '';
    const matching = entry.matching_bullets ?? [];

    if (MANDATORY.has(topic)
      && verdict === 'uncovered' && alignment === 'search_log_overreports') {
      exitCode = 1;
      findings.push(`FAIL ${topic}${tag}: verdict=${verdict}, alignment=${alignment} (mandatory topic — writer over-claimed)`);
      continue;
    }

    if (alignment === 'search_log_overreports') {
      overreports += 1;
      findings.push(`WARN ${topic}${tag}: verdict=${verdict}, alignment=${alignment} (writer over-reported coverage)`);
    } else if (alignment === 'search_log_underreports') {
      underreports += 1;
      findings.push(`WARN ${topic}${tag}: verdict=${verdict}, alignment=${alignment} (writer missed coverage that's actually in news)`);
      if (matching.length)
        findings.push(`     matching bullets: ${pyList(matching)}`);
    } else {
      const mark = verdict === 'covered' ? 'OK' : verdict === 'uncovered' ? '  ' : '??';
      findings.push(`${mark} ${topic}${tag}: verdict=${verdict}, alignment=${alignment}`);
    }
    if (reason && (alignment !== 'consistent' || verdict === 'ambiguous'))
      findings.push(`     reason: ${reason}`);
  }

  const covered = ALL_TOPICS.filter(
    t => verifications.get(t)?.semantic_verdict === 'covered').length;
  findings.push('');
  findings.push(`Summary: ${covered}/${ALL_TOPICS.length} topics covered (semantic verdict)`);
  if (overreports)
    findings.push(`WARN: ${overreports} topic(s) with search_log_overreports — writer's self-report drifted higher than reality`);
  if (underreports)
    findings.push(`WARN: ${underreports} topic(s) with search_log_underreports — writer missed real coverage`);
  findings.push('');
  findings.push(exitCode === 0
    ? 'OK topic coverage (verification mode)'
    : 'FAIL topic coverage — mandatory topic missing or unsearched');
  return [exitCode, findings];
}

/** Python str(list-of-str) formatting for the matching-bullets line. */
function pyList(xs: unknown[]): string {
  return `[${xs.map(x => `'${String(x).replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`).join(', ')}]`;
}

function validateSearchLog(searchLogPath: string): [number, string[]] {
  const log = JSON.parse(readFileSync(searchLogPath, 'utf8'));
  const searches = new Map<string, any>((log.searches ?? []).map((e: any) => [e.topic, e]));
  const findings: string[] = [];
  let exitCode = 0;
  for (const topic of ALL_TOPICS) {
    const entry = searches.get(topic);
    const tag = MANDATORY.has(topic) ? ' [MANDATORY]'
      : NEWS_DRIVEN.has(topic) ? ' [news-driven]' : '';
    if (entry === undefined) {
      findings.push(`-- ${topic}${tag}: NOT IN search_log.json (writer didn't enumerate it)`);
      if (MANDATORY.has(topic)) exitCode = 1;
      continue;
    }
    const searched = Boolean(entry.searched);
    const promoted = Boolean(entry.promoted_to_bullet);
    const hits = entry.hits_found ?? 0;
    if (!searched) {
      const reason = entry.reason_skipped ?? '—';
      findings.push(`-- ${topic}${tag}: searched=false (reason: ${reason})`);
      if (MANDATORY.has(topic)) exitCode = 1;
    } else {
      const mark = promoted || hits > 0 ? 'OK' : '  ';
      findings.push(`${mark} ${topic}${tag}: searched=true, hits=${hits}, promoted=${promoted ? 'True' : 'False'}`);
    }
  }
  findings.push('');
  findings.push(exitCode === 0
    ? 'OK topic coverage (legacy search_log mode — consider upgrading to verification.json)'
    : 'FAIL topic coverage — mandatory topic missing or unsearched');
  return [exitCode, findings];
}

function heuristicSelfAnchored(newsSectionPath: string): [number, string[]] {
  const d = JSON.parse(readFileSync(newsSectionPath, 'utf8'));
  const parts: string[] = [];
  for (const s of d.sections ?? []) {
    parts.push(s.category ?? '');
    for (const b of s.bullets ?? []) {
      parts.push(b.body ?? '');
      for (const c of b.citations ?? []) {
        parts.push(c.label ?? '');
        parts.push(c.url ?? '');
      }
    }
  }
  const haystack = parts.join('\n');
  const findings: string[] = [
    'WARN: neither verification.json nor search_log.json found.',
    'WARN: running self-anchored-only fallback (3 universal identifier topics).',
    'WARN: semantic topic coverage is NOT evaluated in this mode.',
    'WARN: dispatch the verify-topic-coverage sub-agent for full coverage check.',
    '',
  ];
  for (const [topic, patterns] of SELF_ANCHORED) {
    let hitSample: string | null = null;
    for (const p of patterns) {
      const m = p.exec(haystack);
      if (m) { hitSample = m[0]; break; }
    }
    findings.push(hitSample !== null
      ? `OK ${topic} (self-anchored): matched '${hitSample}'`
      : `-- ${topic} (self-anchored): no match`);
  }
  findings.push('');
  findings.push('OK self-anchored fallback complete (mandatory Unsloth not evaluable in this mode)');
  return [0, findings];
}

export function checkTopicCoverage(args: { sourcedataDir: string; date: string }): GateResult {
  const dateDir = join(args.sourcedataDir, args.date);
  const newsSection = join(dateDir, 'news_section.json');
  const searchLog = join(dateDir, 'search_log.json');
  const verification = join(dateDir, 'verification.json');
  const lines: string[] = [];
  if (!existsSync(newsSection)) {
    lines.push(`FAIL: ${newsSection} not found`);
    return { exit: 1, lines };
  }
  lines.push(`check-topic-coverage :: date=${args.date}`);

  const emit = (findings: string[], plainPrefixes: string[]): void => {
    for (const line of findings)
      lines.push(plainPrefixes.some(p => line.startsWith(p)) ? line : `  ${line}`);
  };

  if (existsSync(verification)) {
    lines.push('  mode=verification (verification.json present — LLM auditor verdict)');
    const [exit, findings] = validateVerification(verification);
    emit(findings, ['OK ', 'FAIL ', 'WARN', 'Summary']);
    return { exit, lines };
  }
  if (existsSync(searchLog)) {
    lines.push('  mode=legacy-search-log (search_log.json only — writer self-report)');
    const [exit, findings] = validateSearchLog(searchLog);
    emit(findings, ['OK ', 'FAIL ']);
    return { exit, lines };
  }
  lines.push('  mode=heuristic-fallback (no verification.json or search_log.json)');
  lines.push(`  source: ${newsSection}`);
  const [exit, findings] = heuristicSelfAnchored(newsSection);
  emit(findings, ['OK ', 'FAIL ', 'WARN']);
  return { exit, lines };
}
