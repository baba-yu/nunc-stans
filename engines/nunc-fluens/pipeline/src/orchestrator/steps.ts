/* eslint-disable @typescript-eslint/no-explicit-any */
// The daily DAG steps (Mon–Sat chain): 1_daily_update,
// 2_future_prediction, 3_daily_briefing — ported from the frozen
// scheduled specs. Deviations from the upstream prose are marked
// DEVIATION and recorded in the phase plan.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildStepPrompt, engineDashboardDir, llmArtifactStep, llmJson,
  loadScheduledSpec, loadWriterRules, StepFailure,
} from './core.ts';
import type { RunCtx, StepDef } from './core.ts';
import {
  addDays, latestDormantSnapshot, originPredictions, parseDormantSnapshot,
} from '../weekly/dormant.ts';
import {
  parseBridgesFile, parseChangeLogFile, parseHeadlinesFile, parseNeedsFile,
  parseNewsSectionFile, parsePredictionsFile,
} from '../schemas/sourcedata.ts';
import { renderAndWriteNews, newsOutputPath } from '../render/render-news-md.ts';
import { renderAndWriteFp, fpOutputPath } from '../render/render-future-prediction-md.ts';
import { lintPaths, datePaths } from '../render/lint-markdown-clean.ts';
import { postWriteIntegrity } from '../render/post-write-integrity.ts';
import { ingestDay, ingestDayLocales, dateDir, localeDateDir } from '../ingest/ingest-sourcedata.ts';
import { runGlossaryExtract } from '../ingest/glossary-extract.ts';
import {
  commitDefinition, pendingDefinitions, promoteEligible, retireQuiet,
  retireRefused, type DefinitionFill,
} from '../ingest/glossary-define.ts';
import {
  commitValidation, runValidateGlossary, type Verdict,
} from '../gates/validate-glossary-terms.ts';
import { runScore } from '../ingest/score.ts';
import { runExport } from '../export/export.ts';
import { buildEvidenceReverse } from '../export/evidence-reverse.ts';
import { citationCheck, classifyHost, parsePolicy } from '../gates/citation-check.ts';
import { checkTopicCoverage } from '../gates/check-topic-coverage.ts';
import { loadTopics, topicNames, topicsPromptBlock } from '../topics.ts';
import { searchTopic, validateDeepPlan } from './topic-search.ts';
import type { TopicSearchDeps, TopicSearchRecord } from './topic-search.ts';
import { postUpdateValidation } from '../gates/post-update-validation.ts';
import { checkReadmeLinks } from './readme-checks.ts';
import Database from 'better-sqlite3';
import {
  DAILY_NEWS_REL, exportsDir, FP_REL, readmeSuffixes, REFERENCE_REL,
  REFERENCE_HISTORY_REL,
} from '../world-paths.ts';

/** The full render set for a run: EN plus the effective non-EN set. */
function renderLocales(ctx: RunCtx): string[] {
  return ['en', ...ctx.locales];
}

function sdFile(ctx: RunCtx, name: string): string {
  return join(dateDir(ctx.sourcedataRoot, ctx.date), name);
}

function locFile(ctx: RunCtx, locale: string, name: string): string {
  return join(localeDateDir(ctx.sourcedataRoot, ctx.date, locale), name);
}

// --- glossary LLM-step output validators -----------------------------------

function validateDefinitionFills(raw: unknown, pendingTerms: string[],
  nonEn: readonly string[]): {
  definitions: DefinitionFill[];
  refused: Array<{ term: string; reason: string }>;
} {
  const o = raw as any;
  if (!o || typeof o !== 'object') throw new Error('output is not an object');
  if (!Array.isArray(o.definitions)) throw new Error("missing 'definitions' array");
  if (!Array.isArray(o.refused)) throw new Error("missing 'refused' array");
  const seen = new Set<string>();
  for (const d of o.definitions) {
    // Locale siblings only for the configured set — DB columns for
    // unconfigured locales just stay NULL (EN fallback at export).
    for (const k of ['term', 'quick_def', 'why_it_matters',
      ...nonEn.map(l => `quick_def_${l}`),
      ...nonEn.map(l => `why_it_matters_${l}`)])
      if (typeof d?.[k] !== 'string' || !d[k].trim())
        throw new Error(`definition for ${JSON.stringify(d?.term)} missing required key '${k}' `
          + '(locale siblings are mandatory for every filled term)');
    seen.add(d.term);
  }
  for (const r of o.refused) {
    if (typeof r?.term !== 'string' || typeof r?.reason !== 'string')
      throw new Error("each 'refused' entry needs {term, reason}");
    if (seen.has(r.term)) throw new Error(`term '${r.term}' is both filled and refused`);
    seen.add(r.term);
  }
  const missing = pendingTerms.filter(t => !seen.has(t));
  if (missing.length)
    throw new Error(`pending term(s) not covered: ${missing.join(', ')}`);
  return { definitions: o.definitions, refused: o.refused };
}

function validateSemanticJudgements(raw: unknown, terms: string[]): Array<{
  term: string; verdict: 'match' | 'mismatch' | 'uncertain';
  reason: string; suggested_fix?: string;
}> {
  const o = raw as any;
  if (!o || typeof o !== 'object' || !Array.isArray(o.judgements))
    throw new Error("output must be {judgements: [...]}");
  const byTerm = new Map<string, any>();
  for (const j of o.judgements) {
    if (typeof j?.term !== 'string'
      || !['match', 'mismatch', 'uncertain'].includes(j?.verdict)
      || typeof j?.reason !== 'string')
      throw new Error("each judgement needs {term, verdict: match|mismatch|uncertain, reason}");
    byTerm.set(j.term, j);
  }
  const missing = terms.filter(t => !byTerm.has(t));
  if (missing.length)
    throw new Error(`term(s) not judged: ${missing.join(', ')}`);
  return terms.map(t => byTerm.get(t));
}

function gateOrFail(id: string, r: { exit: number; lines: string[] }, ctx: RunCtx): void {
  for (const l of r.lines) ctx.log(`  ${l}`);
  if (r.exit !== 0) throw new StepFailure(id, `gate exited ${r.exit}`);
}

/** Spec: the parent runs citation-restriction-check on the composed
 * URLs and re-prompts the writer on a RESTRICT hit — enforced at each
 * citation-producing step (news_section, headlines) so it fails there,
 * not three steps later at the rendered-markdown gate. Live only:
 * replay must accept the committed artifact verbatim. */
function assertCitationsAllowed(ctx: RunCtx, urls: string[]): void {
  if (ctx.replay) return;
  const policy = parsePolicy(join(ctx.newsRepo, REFERENCE_REL, 'citation-restrictions.md'));
  const restricted = new Set<string>();
  for (const url of urls) {
    let host = '';
    try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { /* skip */ }
    if (!host) continue;
    const cls = classifyHost(host, policy);
    if (cls === 'denylist' || cls === 'parent_inherited' || cls === 'unconfirmed_denylist')
      restricted.add(host);
  }
  if (restricted.size)
    throw new Error(`citations use restricted hosts: ${[...restricted].join(', ')} `
      + '— substitute an allowed source for the same factual claim (or drop the bullet)');
}

// ---------------------------------------------------------------------------
// 1_daily_update
// ---------------------------------------------------------------------------

export function dailyUpdateSteps(): StepDef[] {
  return [
    {
      id: 'compose-news-section', kind: 'llm',
      run: async (ctx) => {
        // The search axis (S-3): 'native' rides the runtime's own web
        // tool; an external source runs the fan-out HERE — one query per
        // topic through the configured adapter — and inlines the results
        // (a local model has no search of its own).
        let searchBlock = '';
        if (ctx.search !== 'native' && !ctx.replay && ctx.ai
          && !existsSync(sdFile(ctx, 'news_section.json'))) {
          // Topics-authoring W3: intent-weighted fan-out — watch=1 query,
          // broad=light multi-angle, deep=the goal-driven plan/judge loop
          // (LLM decisions; deterministic execution + code-enforced stop).
          // The loop's decisions are captured in search_plan.json (audit;
          // replay never re-searches).
          const ai = ctx.ai;
          const tf = loadTopics(ctx.newsRepo);
          const deps: TopicSearchDeps = {
            search: async (q) => {
              try {
                return await ai.search(ctx.search, q, { count: 5 });
              } finally {
                await new Promise(res => setTimeout(res, 1100)); // free-tier rate limit
              }
            },
            plan: (topic, round, seenSummary) => llmJson(ctx, {
              id: 'deep-search',
              validate: validateDeepPlan,
              prompt: buildStepPrompt({
                skill: 'deep-search', date: ctx.date,
                extra: [
                  `Topic: ${topic.name}`,
                  topic.note ? `Authoring note: ${topic.note}` : '',
                  `Round: ${round}`,
                  'Results surfaced so far:',
                  seenSummary,
                ].filter(Boolean).join('\n'),
                outputNote: 'the deep-search plan JSON ({queries, goal_met, reason}).',
              }),
            }),
            log: ctx.log,
          };
          const chunks: string[] = [];
          const records: TopicSearchRecord[] = [];
          for (const topic of tf.topics) {
            const { chunk, record } = await searchTopic(topic, deps);
            if (chunk) chunks.push(chunk);
            records.push(record);
            ctx.log(`  topic '${topic.name}' [${topic.intent}] → ${record.urls.length} urls (${record.stopped})`);
          }
          mkdirSync(dateDir(ctx.sourcedataRoot, ctx.date), { recursive: true });
          writeFileSync(sdFile(ctx, 'search_plan.json'),
            JSON.stringify({ date: ctx.date, search: ctx.search, topics: records }, null, 2));
          if (!chunks.length)
            throw new StepFailure('compose-news-section',
              `external search via '${ctx.search}' returned nothing for any topic`);
          searchBlock = `\n\nToday's research results (${ctx.search} search, `
            + 'gathered by the orchestrator — base the sections on THESE):\n\n'
            + chunks.join('\n\n');
        }
        return llmArtifactStep(ctx, {
          id: 'compose-news-section',
          artifact: sdFile(ctx, 'news_section.json'),
          // Spec: the parent runs citation-restriction-check on the
          // composed URLs and re-prompts the writer on a RESTRICT hit —
          // handle it HERE, not three steps later at citation-check-news
          // (exit run (b)'s local model chose a denylisted host).
          // Live only: replay must accept the committed artifact as-is.
          validate: (raw) => {
            const parsed = parseNewsSectionFile(raw);
            assertCitationsAllowed(ctx,
              parsed.sections.flatMap(s => s.bullets.flatMap(b => b.citations.map(c => c.url))));
            return parsed;
          },
          webSearch: ctx.search === 'native',
          // Headless steps have no file access — every input is inlined
          // (the first live run proved the point: a prompt that only
          // NAMES its input files gets an honest empty answer back).
          prompt: () => {
            const topics = topicsPromptBlock(loadTopics(ctx.newsRepo));
            const refPath = join(ctx.newsRepo, REFERENCE_HISTORY_REL);
            const recentRefs = existsSync(refPath)
              ? readFileSync(refPath, 'utf8').trim().split('\n').slice(-300).join('\n')
              : '';
            return buildStepPrompt({
              skill: 'compose-news-section', date: ctx.date,
              writerRules: loadWriterRules('1_daily_update'),
              extra: [
                'Reference topic list (data/reference/news-topics.json — search the '
                + 'trusted sources for the last 3 days; always include every mandatory topic):',
                topics,
                'Recently cited URLs to SKIP (tail of the citation ledger '
                + 'data/history/reference-history.log):',
                recentRefs,
              ].join('\n\n') + searchBlock,
              outputNote: 'the news_section.json document ({date, sections[]}).',
            });
          },
        });
      },
    },
    {
      id: 'compose-predictions', kind: 'llm',
      run: (ctx) => llmArtifactStep(ctx, {
        id: 'compose-predictions',
        artifact: sdFile(ctx, 'predictions.json'),
        validate: parsePredictionsFile,
        prompt: () => buildStepPrompt({
          skill: 'compose-prediction', date: ctx.date,
          writerRules: loadWriterRules('1_daily_update'),
          extra: `Today's news_section.json:\n`
            + readFileSync(sdFile(ctx, 'news_section.json'), 'utf8')
            + '\n\nProduce exactly 3 predictions.',
          outputNote: 'the predictions.json document ({date, predictions[3]}).',
        }),
      }),
    },
    {
      id: 'compose-headlines', kind: 'llm',
      run: (ctx) => llmArtifactStep(ctx, {
        id: 'compose-headlines',
        artifact: sdFile(ctx, 'headlines.json'),
        validate: (raw) => {
          const parsed = parseHeadlinesFile(raw);
          assertCitationsAllowed(ctx,
            parsed.technical.flatMap(t => t.citations.map(c => c.url)));
          return parsed;
        },
        prompt: () => buildStepPrompt({
          skill: 'compose-headlines-pair', date: ctx.date,
          writerRules: loadWriterRules('1_daily_update'),
          extra: `Today's news_section.json (cite ONLY sources already used `
            + `here — do not introduce new hosts):\n`
            + readFileSync(sdFile(ctx, 'news_section.json'), 'utf8'),
          outputNote: 'the headlines.json document ({date, technical[], plain[]}).',
        }),
      }),
    },
    {
      id: 'compose-change-log', kind: 'llm',
      run: (ctx) => llmArtifactStep(ctx, {
        id: 'compose-change-log',
        artifact: sdFile(ctx, 'change_log.json'),
        validate: parseChangeLogFile,
        prompt: () => buildStepPrompt({
          skill: 'compose-change-log', date: ctx.date,
          writerRules: loadWriterRules('1_daily_update'),
          extra: `Today's news_section.json:\n`
            + readFileSync(sdFile(ctx, 'news_section.json'), 'utf8'),
          outputNote: 'the change_log.json document ({date, vs_date, items[]}).',
        }),
      }),
    },
    {
      id: 'extract-needs', kind: 'llm',
      run: (ctx) => llmArtifactStep(ctx, {
        id: 'extract-needs',
        artifact: sdFile(ctx, 'needs.json'),
        validate: parseNeedsFile,
        prompt: () => buildStepPrompt({
          skill: 'extract-needs', date: ctx.date,
          extra: `Today's predictions.json:\n`
            + readFileSync(sdFile(ctx, 'predictions.json'), 'utf8'),
          outputNote: 'the needs.json document ({date, by_prediction}).',
        }),
      }),
    },
    {
      id: 'translate-news', kind: 'llm',
      run: async (ctx) => {
        // One artifact set per locale; pooled in live mode.
        const kinds: Array<[string, (d: unknown) => unknown]> = [
          ['predictions.json', parsePredictionsFile],
          ['headlines.json', parseHeadlinesFile],
          ['change_log.json', parseChangeLogFile],
          ['news_section.json', parseNewsSectionFile],
          ['needs.json', parseNeedsFile],
        ];
        // Local runtimes serve one request at a time — parallel locale
        // fan-out just parks the queued sockets until they time out.
        const fanout = ctx.runtime === 'claude-code'
          ? <T>(xs: readonly T[], f: (x: T) => Promise<void>) => Promise.all(xs.map(f)).then(() => undefined)
          : async <T>(xs: readonly T[], f: (x: T) => Promise<void>) => { for (const x of xs) await f(x); };
        await fanout(ctx.locales, async (L) => {
          for (const [name, validate] of kinds) {
            await llmArtifactStep(ctx, {
              id: `translate-news:${L}:${name}`,
              artifact: locFile(ctx, L, name),
              validate,
              prompt: () => buildStepPrompt({
                skill: 'locale-fanout', date: ctx.date,
                extra: `Target locale: ${L}\nEN canonical ${name}:\n`
                  + readFileSync(sdFile(ctx, name), 'utf8'),
                outputNote: `the ${L} locale sibling of ${name} (same shape, values translated per the contract).`,
              }),
            });
          }
        });
      },
    },
    {
      id: 'render-news', kind: 'det',
      run: (ctx) => {
        for (const L of renderLocales(ctx))
          renderAndWriteNews(ctx.sourcedataRoot, ctx.newsRepo, ctx.date, L);
      },
    },
    {
      // DEVIATION: the spec places glossary at steps 5–6.5 (before the
      // markdown exists); the golden capture — and therefore the DB
      // parity target — runs it on the freshly rendered EN report.
      id: 'glossary-extract', kind: 'det',
      run: (ctx) => {
        runGlossaryExtract(ctx.db, {
          newsFile: newsOutputPath(ctx.newsRepo, ctx.date, 'en'),
          seedYaml: join(ctx.newsRepo, REFERENCE_REL, 'glossary.yml'),
          todayIso: ctx.todayIso,
        });
      },
    },
    {
      // 1_daily_update step 6: promotion/retirement flips + the LLM
      // definition fill. DEVIATION (recorded): upstream these were
      // conversational-orchestrator calls and the golden capture never
      // ran them, so the golden DB embodies their absence — replay and
      // dry-run skip to preserve that state; live runs do the work.
      id: 'glossary-define', kind: 'llm',
      run: async (ctx) => {
        if (ctx.replay || ctx.dryRun) {
          ctx.log('  skipped (replay/dry-run): not part of the golden capture');
          return;
        }
        const promoted = promoteEligible(ctx.db, ctx.todayIso);
        const retired = retireQuiet(ctx.db, ctx.todayIso);
        ctx.log(`  promoted ${promoted.length}, retired ${retired.length} (quiet rule)`);
        const pending = pendingDefinitions(ctx.db);
        if (!pending.length) {
          ctx.log('  no pending definitions');
          return;
        }
        const out = await llmJson(ctx, {
          id: 'glossary-define',
          prompt: buildStepPrompt({
            skill: 'define-glossary-terms', date: ctx.date,
            extra: 'Pending terms needing definitions (follow the "LLM fill '
              + 'prompt" section of the spec, including all locale siblings '
              + 'and the refusal rules):\n'
              + JSON.stringify(pending, null, 2),
            // Locale-sibling keys derive from the configured set (the
            // spec's ja/es/fil enumeration is the full-trio case).
            outputNote: '{"definitions": [{"term", "quick_def", "why_it_matters", '
              + [...ctx.locales.map(l => `"quick_def_${l}", `),
                ...ctx.locales.map(l => `"why_it_matters_${l}", `)].join('')
              + '"canonical_link" (optional)}], "refused": [{"term", "reason"}]} — '
              + 'every pending term appears in exactly one of the two lists.',
          }),
          validate: (raw) => validateDefinitionFills(raw, pending.map(p => p.term), ctx.locales),
        });
        for (const d of out.definitions) commitDefinition(ctx.db, ctx.todayIso, d);
        for (const r of out.refused) retireRefused(ctx.db, ctx.todayIso, r.term);
        ctx.log(`  filled ${out.definitions.length}, refused ${out.refused.length}`);
      },
    },
    {
      // 1_daily_update step 6.5: form + dedupe (det, audited) then the
      // semantic LLM-as-judge pass over the pending queue. Same
      // replay/dry-run deviation as glossary-define.
      id: 'glossary-validate', kind: 'llm',
      run: async (ctx) => {
        if (ctx.replay || ctx.dryRun) {
          ctx.log('  skipped (replay/dry-run): not part of the golden capture');
          return;
        }
        const summary = runValidateGlossary(ctx.db, { today: ctx.todayIso });
        ctx.log(`  audit retention: pruned ${summary.prunedAudit} rows `
          + `older than 30d (semantic pass/fail exempt)`);
        ctx.log(`  form+dedupe: ${summary.checked} checked, `
          + `${summary.retiredByFormOrDedupe.length} retired, `
          + `${summary.warned.length} warned`);
        if (!summary.pendingSemantic.length) {
          ctx.log('  semantic queue empty');
          return;
        }
        const judged = await llmJson(ctx, {
          id: 'glossary-validate',
          prompt: buildStepPrompt({
            skill: 'validate-glossary-terms', date: ctx.date,
            extra: 'You are the semantic LLM-as-judge pass. For each term '
              + 'below, judge whether the definition matches the term\'s '
              + 'commonly-understood industry meaning.\n'
              + JSON.stringify(summary.pendingSemantic, null, 2),
            outputNote: '{"judgements": [{"term", "verdict": '
              + '"match"|"mismatch"|"uncertain", "reason", '
              + '"suggested_fix" (optional)}]} — one judgement per term.',
          }),
          validate: (raw) => validateSemanticJudgements(
            raw, summary.pendingSemantic.map(r => r.term)),
        });
        for (const j of judged) {
          const verdict: Verdict = {
            check_type: 'semantic',
            // The audit table owns the vocabulary: match→pass,
            // mismatch→fail (retires), uncertain→warn (stays queued).
            verdict: j.verdict === 'match' ? 'pass'
              : j.verdict === 'mismatch' ? 'fail' : 'warn',
            reason: j.reason,
            suggested_fix: j.suggested_fix,
          };
          commitValidation(ctx.db, {
            term: j.term, verdicts: [verdict], today: ctx.todayIso,
          });
        }
        const retired = judged.filter(j => j.verdict === 'mismatch').length;
        ctx.log(`  semantic: ${judged.length} judged, ${retired} retired`);
      },
    },
    {
      id: 'citation-check-news', kind: 'det',
      // DEVIATION: run on the rendered markdown (same link surface) —
      // the JSON files carry citations as {label,url} objects. The
      // unclassified-host ledger is a cumulative sighting counter, so
      // replay must not re-increment it (S-4: the day was already
      // counted when it ran live) — gates still run.
      run: (ctx) => {
        for (const L of renderLocales(ctx)) {
          const r = citationCheck({
            draft: newsOutputPath(ctx.newsRepo, ctx.date, L),
            policyFile: join(ctx.newsRepo, REFERENCE_REL, 'citation-restrictions.md'),
            unclassifiedOut: L === 'en' && !ctx.replay
              ? join(ctx.newsRepo, REFERENCE_REL, 'citation-policy-review.md') : null,
            todayIso: ctx.todayIso,
          });
          gateOrFail('citation-check-news', r, ctx);
        }
      },
    },
    {
      id: 'append-references', kind: 'det',
      run: (ctx) => {
        const refPath = join(ctx.newsRepo, REFERENCE_HISTORY_REL);
        const existing = new Set(
          existsSync(refPath)
            ? readFileSync(refPath, 'utf8').split('\n').map(s => s.trim()).filter(Boolean)
            : []);
        const urls: string[] = [];
        const collect = (v: any): void => {
          if (Array.isArray(v)) { v.forEach(collect); return; }
          if (v && typeof v === 'object') {
            if (typeof v.url === 'string') urls.push(v.url);
            Object.values(v).forEach(collect);
          }
        };
        for (const name of ['news_section.json', 'predictions.json', 'headlines.json', 'bridges.json']) {
          const p = sdFile(ctx, name);
          if (existsSync(p)) collect(JSON.parse(readFileSync(p, 'utf8')));
        }
        const fresh = urls.filter(u => !existing.has(u));
        const deduped = [...new Set(fresh)];
        if (deduped.length && !ctx.dryRun)
          appendFileSync(refPath, deduped.join('\n') + '\n');
        ctx.log(`  reference-history.log: +${deduped.length} new URL(s)`);
      },
    },
    {
      id: 'ingest-sourcedata', kind: 'det',
      run: (ctx) => {
        const { pidByJsonId } = ingestDay(ctx.db, {
          sourcedataRoot: ctx.sourcedataRoot,
          repoRootForRel: ctx.newsRepo,
          todayIso: ctx.todayIso,
        }, ctx.date);
        ingestDayLocales(ctx.db, {
          sourcedataRoot: ctx.sourcedataRoot,
          repoRootForRel: ctx.newsRepo,
          todayIso: ctx.todayIso,
          locales: ctx.locales,
        }, ctx.date, pidByJsonId);
      },
    },
    {
      id: 'lint-news', kind: 'det',
      run: (ctx) => gateOrFail('lint-news',
        lintPaths(datePaths(ctx.newsRepo, ctx.date, renderLocales(ctx))), ctx),
    },
    {
      id: 'verify-topic-coverage', kind: 'llm',
      run: (ctx) => {
        // The downstream check-topic-coverage gate matches topic names
        // EXACTLY against the instance's news-topics.json and requires
        // every mandatory row — so enforce verbatim enumeration here (a
        // local model abbreviated the names on exit run (b) and the gate
        // failed three... one step later). Re-prompt on any miss.
        const allTopics = topicNames(loadTopics(ctx.newsRepo));
        return llmArtifactStep(ctx, {
          id: 'verify-topic-coverage',
          artifact: sdFile(ctx, 'verification.json'),
          validate: (raw: any) => {
            if (typeof raw !== 'object' || raw === null || !Array.isArray(raw.verifications))
              throw new Error('verification.json: expected {verifications: []}');
            if (!ctx.replay) {
              const seen = new Set(raw.verifications.map((v: any) => v?.topic));
              const missing = allTopics.filter(t => !seen.has(t));
              if (missing.length)
                throw new Error('verification.json must enumerate EVERY topic '
                  + `by its exact name; missing: ${missing.map(m => `"${m}"`).join(', ')}`);
            }
            return raw;
          },
          prompt: () => buildStepPrompt({
            skill: 'verify-topic-coverage', date: ctx.date,
            extra: `Today's news_section.json:\n`
              + readFileSync(sdFile(ctx, 'news_section.json'), 'utf8')
              + '\n\nEnumerate a verification entry for EVERY ONE of these topics, '
              + 'using the topic string VERBATIM as the `topic` field '
              + '(semantic_verdict covered|uncovered|ambiguous, '
              + 'search_log_alignment consistent|search_log_overreports|'
              + 'search_log_underreports, matching_bullets, reason):\n'
              + allTopics.map(t => `- ${t}`).join('\n'),
            outputNote: 'the verification.json document ({date, verifications[]}) '
              + `covering all ${allTopics.length} topics verbatim.`,
          }),
        });
      },
    },
    {
      id: 'check-topic-coverage', kind: 'det',
      run: (ctx) => gateOrFail('check-topic-coverage',
        checkTopicCoverage({
          sourcedataDir: ctx.sourcedataRoot, date: ctx.date,
          topics: loadTopics(ctx.newsRepo).topics,
        }), ctx),
    },
    {
      id: 'puv-news', kind: 'det',
      run: (ctx) => gateOrFail('puv-news', postUpdateValidation({
        check: 'news', date: ctx.date, db: ctx.dbFile,
        exportsDir: exportsDir(ctx.newsRepo), repoRoot: ctx.newsRepo,
        locales: ctx.locales,
      }), ctx),
    },
  ];
}

// ---------------------------------------------------------------------------
// 2_future_prediction
// ---------------------------------------------------------------------------

export function futurePredictionSteps(): StepDef[] {
  return [
    {
      id: 'compose-validation-rows', kind: 'llm',
      run: (ctx) => llmArtifactStep(ctx, {
        id: 'compose-validation-rows',
        artifact: sdFile(ctx, 'bridges.json'),
        validate: (raw) => {
          const parsed = parseBridgesFile(raw);
          // §1.3 rule 1: every last-7-days prediction gets a row — an
          // empty table on a day with recent predictions is a refusal,
          // not a result (the first live run shipped one and the puv
          // gate caught it three steps later).
          if (!parsed.validation_rows.length)
            throw new Error('validation_rows is empty — §1.3 rule 1 requires a row '
              + 'for every prediction from the last 7 days');
          // Writer contract: EVERY row carries a filled bridge paragraph
          // — a no-signal day gets a bridge that says what today's news
          // failed to touch and the remaining gap (the puv gate rejects
          // empty bridge_text row by row; live run 2 shipped 10 empties).
          const empty = parsed.validation_rows
            .filter(r => !r.bridge.narrative.trim())
            .map(r => r.prediction_ref.id);
          if (empty.length)
            throw new Error(`bridge.narrative is empty on ${empty.length} row(s) `
              + `(${empty.slice(0, 5).join(', ')}…) — every row needs a bridge `
              + 'paragraph; on no-signal days it states what today\'s news did '
              + 'not touch and the remaining gap');
          return parsed;
        },
        // All inputs inlined (headless steps cannot read files): the
        // last-7-days predictions, the dormant due/revival material
        // (layer 1 computed here, deterministically), and today's news.
        prompt: () => {
          const preds: Array<Record<string, string>> = [];
          for (let off = -6; off <= 0; off++) {
            const d = addDays(ctx.date, off);
            originPredictions(ctx.sourcedataRoot, d).forEach((p, i) => preds.push({
              prediction_id: p.hash,
              short_id: `${d.replaceAll('-', '')}-${i + 1}`,
              origin_date: d,
              title: p.title,
              body: p.body.slice(0, 600),
            }));
          }
          const snap = latestDormantSnapshot(ctx.newsRepo, ctx.date);
          const dormantRows = snap
            ? parseDormantSnapshot(readFileSync(snap.path, 'utf8')) : [];
          const due = dormantRows
            .filter(r => r.nextPing <= ctx.date)
            .map(r => ({ id: r.id, short: r.short, first_seen: r.firstSeen }));
          const newsText = readFileSync(sdFile(ctx, 'news_section.json'), 'utf8');
          const newsLower = newsText.toLowerCase();
          const layer1 = dormantRows
            .map(r => ({
              id: r.id, short: r.short,
              matched_signals: r.signals.split(',').map(s => s.trim())
                .filter(s => s && newsLower.includes(s.toLowerCase())),
            }))
            .filter(h => h.matched_signals.length);
          return buildStepPrompt({
            skill: 'compose-validation-rows', date: ctx.date,
            writerRules: loadWriterRules('2_future_prediction'),
            extra: [
              "Today's news_section.json (evaluate relevance against THIS):",
              newsText,
              'Predictions from the last 7 days — §1.3 rule 1: EVERY one of '
              + 'these gets a validation row (honest relevance 1-5):',
              JSON.stringify(preds, null, 1),
              'Dormant predictions due for a forced re-check (§1.3 rule 2 — '
              + 'include each as a row):',
              JSON.stringify(due, null, 1),
              'Layer-1 dormant signal hits in today\'s news (§1.5 — candidates '
              + 'for [REVIVED] rows; apply layer 2 yourself over the dormant '
              + 'shorts below and union the layers):',
              JSON.stringify(layer1, null, 1),
              'All dormant shorts (for layer-2 semantic scan):',
              JSON.stringify(dormantRows.map(r => ({ id: r.id, short: r.short }))),
              'Fill the bridge narratives too (compose-bridge contract). '
              + 'EVERY row must carry a non-empty bridge narrative — on '
              + 'no-signal days the bridge states what today\'s news did NOT '
              + 'touch for this prediction and the remaining gap (coherence '
              + 'low, not zero-length).',
            ].join('\n\n'),
            outputNote: 'the bridges.json document ({date, validation_rows[]}) with bridges filled.',
          });
        },
      }),
    },
    {
      id: 'compose-summary', kind: 'llm',
      run: async (ctx) => {
        // summary.json is optional — replay accepts absence.
        const artifact = sdFile(ctx, 'summary.json');
        if (!existsSync(artifact) && ctx.replay) {
          ctx.log('  summary.json absent — optional, skipping in replay');
          return;
        }
        await llmArtifactStep(ctx, {
          id: 'compose-summary',
          artifact,
          validate: (raw: any) => {
            if (typeof raw !== 'object' || raw === null) throw new Error('summary.json: expected object');
            return raw;
          },
          prompt: () => buildStepPrompt({
            skill: 'compose-validation-rows', date: ctx.date,
            extra: `Today's bridges.json:\n${readFileSync(sdFile(ctx, 'bridges.json'), 'utf8')}\n\n`
              + 'Emit the report-level summary (plain_language ≤200 chars, findings, relation_to_my_preds).',
            outputNote: 'the summary.json document ({plain_language?, findings?, relation_to_my_preds?}).',
          }),
        });
      },
    },
    {
      id: 'translate-fp', kind: 'llm',
      run: async (ctx) => {
        // Same serial-for-local-runtimes rule as translate-news.
        const fanout = ctx.runtime === 'claude-code'
          ? <T>(xs: readonly T[], f: (x: T) => Promise<void>) => Promise.all(xs.map(f)).then(() => undefined)
          : async <T>(xs: readonly T[], f: (x: T) => Promise<void>) => { for (const x of xs) await f(x); };
        await fanout(ctx.locales, async (L) => {
          await llmArtifactStep(ctx, {
            id: `translate-fp:${L}:bridges.json`,
            artifact: locFile(ctx, L, 'bridges.json'),
            validate: parseBridgesFile,
            prompt: () => buildStepPrompt({
              skill: 'locale-fanout', date: ctx.date,
              extra: `Target locale: ${L}\nEN canonical bridges.json:\n`
                + readFileSync(sdFile(ctx, 'bridges.json'), 'utf8')
                + '\nKeep prediction_ref.short_label English (identity key).',
              outputNote: `the ${L} locale sibling of bridges.json.`,
            }),
          });
          const enSummary = sdFile(ctx, 'summary.json');
          if (existsSync(enSummary)) {
            const locSummary = locFile(ctx, L, 'summary.json');
            if (!existsSync(locSummary) && ctx.replay) return; // optional
            await llmArtifactStep(ctx, {
              id: `translate-fp:${L}:summary.json`,
              artifact: locSummary,
              validate: (raw: any) => {
                if (typeof raw !== 'object' || raw === null) throw new Error('summary.json: expected object');
                return raw;
              },
              prompt: () => buildStepPrompt({
                skill: 'locale-fanout', date: ctx.date,
                extra: `Target locale: ${L}\nEN canonical summary.json:\n`
                  + readFileSync(enSummary, 'utf8'),
                outputNote: `the ${L} locale sibling of summary.json.`,
              }),
            });
          }
        });
      },
    },
    {
      id: 'render-fp', kind: 'det',
      run: (ctx) => {
        for (const L of renderLocales(ctx))
          renderAndWriteFp(ctx.sourcedataRoot, ctx.newsRepo, ctx.date, L);
      },
    },
    {
      id: 'citation-check-fp', kind: 'det',
      run: (ctx) => {
        for (const L of renderLocales(ctx)) {
          const r = citationCheck({
            draft: fpOutputPath(ctx.newsRepo, ctx.date, L),
            policyFile: join(ctx.newsRepo, REFERENCE_REL, 'citation-restrictions.md'),
            unclassifiedOut: L === 'en' && !ctx.replay
              ? join(ctx.newsRepo, REFERENCE_REL, 'citation-policy-review.md') : null,
            todayIso: ctx.todayIso,
          });
          gateOrFail('citation-check-fp', r, ctx);
        }
      },
    },
    {
      id: 'ingest-sourcedata-fp', kind: 'det',
      run: (ctx) => {
        // Live mode needs this second pass: bridges.json did not exist
        // when 1_daily_update ingested. In replay every artifact was
        // present for the first pass, and re-running flips evidence
        // updated_at (the only observable double-ingest side effect) —
        // skip to match the single-ingest golden recipe.
        if (ctx.replay) {
          ctx.log('  replay: day fully ingested in 1_daily_update — skipping');
          return;
        }
        const { pidByJsonId } = ingestDay(ctx.db, {
          sourcedataRoot: ctx.sourcedataRoot,
          repoRootForRel: ctx.newsRepo,
          todayIso: ctx.todayIso,
        }, ctx.date);
        ingestDayLocales(ctx.db, {
          sourcedataRoot: ctx.sourcedataRoot,
          repoRootForRel: ctx.newsRepo,
          todayIso: ctx.todayIso,
          locales: ctx.locales,
        }, ctx.date, pidByJsonId);
      },
    },
    {
      id: 'lint-fp', kind: 'det',
      run: (ctx) => gateOrFail('lint-fp',
        lintPaths(datePaths(ctx.newsRepo, ctx.date, renderLocales(ctx))), ctx),
    },
    {
      id: 'puv-fp', kind: 'det',
      run: (ctx) => gateOrFail('puv-fp', postUpdateValidation({
        check: 'future-prediction', date: ctx.date, db: ctx.dbFile,
        exportsDir: exportsDir(ctx.newsRepo), repoRoot: ctx.newsRepo,
        locales: ctx.locales,
      }), ctx),
    },
  ];
}

// ---------------------------------------------------------------------------
// 3_daily_briefing
// ---------------------------------------------------------------------------

export function dailyBriefingSteps(): StepDef[] {
  return [
    {
      id: 'verify-fp-exists', kind: 'det',
      run: (ctx) => {
        const p = fpOutputPath(ctx.newsRepo, ctx.date, 'en');
        if (!existsSync(p))
          throw new StepFailure('verify-fp-exists', `${p} missing — abort the briefing`);
      },
    },
    {
      id: 'readme-window', kind: 'llm',
      run: async (ctx) => {
        // Replay/resume: accept READMEs that already carry today's block.
        for (const L of readmeSuffixes(ctx.locales)) {
          const path = join(ctx.newsRepo, `README${L}.md`);
          const hasToday = existsSync(path)
            && new RegExp(`^## ${ctx.date}\\s*$`, 'm').test(readFileSync(path, 'utf8'));
          if (hasToday) continue;
          if (ctx.replay)
            throw new StepFailure('readme-window',
              `replay: README${L}.md lacks today's block`);
          if (ctx.ai === null) throw new StepFailure('readme-window', 'no AI runtime');
          const locSeg = L === '' ? 'en' : L.slice(1);
          const prev = existsSync(path) ? readFileSync(path, 'utf8') : '';
          // Inline today's rendered files — headless steps cannot read
          // them, and a README block written blind would be fabrication.
          const todayNews = readFileSync(
            newsOutputPath(ctx.newsRepo, ctx.date, locSeg), 'utf8');
          const todayFp = readFileSync(
            fpOutputPath(ctx.newsRepo, ctx.date, locSeg), 'utf8');
          const res = await ctx.ai.chat(ctx.runtime, [{
            role: 'user',
            content: [
              'You are the readme-window step of the nunc-fluens daily pipeline, '
              + 'run headlessly.',
              `Today's date: ${ctx.date}.`,
              '',
              '--- SPEC (prompts/scheduled/3_daily_briefing.md) ---',
              loadScheduledSpec('3_daily_briefing'),
              '--- END SPEC ---',
              '',
              // P5 ground truth: the spec speaks in configured-set
              // terms — pin the concrete set so the model needn't
              // infer it (and spec wording drift can't mislead it).
              `This run's locale set: ${['en', ...ctx.locales].join(', ')}.`,
              `Rewrite README${L}.md as the 3-day window ending ${ctx.date} `
              + `for locale '${locSeg}' per Step 2 of the spec.`,
              // Cold-start lesson (2026-07-07): with no prior README to
              // imitate, the model reproduced the spec's `<L>` path
              // placeholders (and spec prose) literally. Pin the exact
              // link targets for THIS locale and forbid spec leakage.
              `Use these EXACT link targets for this file — the locale segment is '${locSeg}', `
              + `never a placeholder like <L>: `
              + `[news-${ctx.date.replaceAll('-', '')}.md](${DAILY_NEWS_REL}/${locSeg}/news-${ctx.date.replaceAll('-', '')}.md) and `
              + `[future-prediction-${ctx.date.replaceAll('-', '')}.md](${FP_REL}/${locSeg}/future-prediction-${ctx.date.replaceAll('-', '')}.md). `
              + `The SPEC above is instructions, not content: never quote its prose, file names, or checklists in the README.`,
              `Current file:\n${prev}`,
              `Today's news file (${DAILY_NEWS_REL}/${locSeg}/news-${ctx.date.replaceAll('-', '')}.md):\n${todayNews}`,
              `Today's FP file (${FP_REL}/${locSeg}/future-prediction-${ctx.date.replaceAll('-', '')}.md):\n${todayFp}`,
              'Reply with the FULL new README content, nothing else — no fences, no prose around it.',
            ].join('\n\n'),
          }], { caller: `readme-window:${locSeg}` });
          if (!ctx.dryRun) writeFileSync(path, res.text.endsWith('\n') ? res.text : res.text + '\n');
        }
      },
    },
    {
      id: 'readme-checks', kind: 'det',
      run: (ctx) => {
        const link = checkReadmeLinks(ctx.newsRepo, ctx.locales);
        for (const l of link.lines) ctx.log(`  ${l}`);
        if (link.exit !== 0) throw new StepFailure('readme-checks', 'link routing failed');
        const pwi = postWriteIntegrity('readme',
          readmeSuffixes(ctx.locales).map(L => join(ctx.newsRepo, `README${L}.md`)));
        gateOrFail('readme-checks', pwi, ctx);
      },
    },
    {
      // DEVIATION: the upstream run-update-pages rebuilt the DB from
      // scratch (legacy markdown ingest included) and re-ran pytest.
      // The pipeline's DB is the persistent migrated store, so this
      // step is score + export + evidence-reverse + integrity.
      id: 'update-pages', kind: 'det',
      run: (ctx) => {
        runScore(ctx.db);
        const outDir = exportsDir(ctx.newsRepo);
        runExport(ctx.db, {
          outputDir: outDir, publishRoot: ctx.newsRepo, locales: ctx.locales,
        });
        const ber = buildEvidenceReverse(ctx.db, { todayIso: ctx.todayIso });
        writeFileSync(join(outDir, 'evidence-reverse.json'),
          JSON.stringify(ber, null, 2), 'utf8');
        const check = new Database(ctx.dbFile, { readonly: true });
        const ok = check.pragma('integrity_check', { simple: true });
        check.close();
        if (ok !== 'ok') throw new StepFailure('update-pages', `sqlite integrity: ${ok}`);
      },
    },
    {
      // P2: the dashboard is product code (engines/nunc-fluens/dashboard/),
      // not instance data — check the ENGINE copy is present and
      // structurally whole, then the instance's exported manifest shape.
      id: 'dashboard-integrity', kind: 'det',
      run: (ctx) => {
        const dash = engineDashboardDir();
        const assets = ['index.html', 'assets/app.js', 'assets/styles.css']
          .map(p => join(dash, p));
        const missing = assets.filter(p => !existsSync(p));
        if (missing.length)
          throw new StepFailure('dashboard-integrity',
            `engine dashboard file(s) missing: ${missing.join(', ')}`);
        gateOrFail('dashboard-integrity', postWriteIntegrity('dashboard-asset', assets), ctx);
        const m = JSON.parse(readFileSync(join(exportsDir(ctx.newsRepo), 'manifest.json'), 'utf8'));
        // en + the effective set (default trio ⇒ the historical 4).
        if ((m.locales ?? []).length !== ctx.locales.length + 1 || m.default_locale !== 'en')
          throw new StepFailure('dashboard-integrity', 'manifest shape check failed');
      },
    },
    {
      id: 'puv-exports', kind: 'det',
      run: (ctx) => gateOrFail('puv-exports', postUpdateValidation({
        check: 'exports', date: ctx.date, db: ctx.dbFile,
        exportsDir: exportsDir(ctx.newsRepo), repoRoot: ctx.newsRepo,
        locales: ctx.locales,
      }), ctx),
    },
    // The news-era `publish` step (git add/commit/push) is retired
    // (R10): instances are git-less — the written files ARE the
    // product; run.json is written once by the dag at end of run.
  ];
}
