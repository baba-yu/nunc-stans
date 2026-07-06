/* eslint-disable @typescript-eslint/no-explicit-any */
// The daily DAG steps (Mon–Sat chain): 1_daily_update,
// 2_future_prediction, 3_daily_briefing — ported from the frozen
// scheduled specs. Deviations from the upstream prose are marked
// DEVIATION and recorded in the phase plan.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  buildStepPrompt, llmArtifactStep, llmJson, loadWriterRules, StepFailure,
} from './core.ts';
import type { RunCtx, StepDef } from './core.ts';
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
import { citationCheck } from '../gates/citation-check.ts';
import { checkTopicCoverage } from '../gates/check-topic-coverage.ts';
import { postUpdateValidation } from '../gates/post-update-validation.ts';
import { checkReadmeLinks } from './readme-checks.ts';
import Database from 'better-sqlite3';
import {
  DOCS_DIR, docsDataDir, FP_DIR, LOCALES, MEMORY_DIR,
  NON_EN_LOCALES as NON_EN, REFERENCE_DIR, REFERENCES_TXT, REPORT_DIR,
} from '../world-paths.ts';

function sdFile(ctx: RunCtx, name: string): string {
  return join(dateDir(ctx.sourcedataRoot, ctx.date), name);
}

function locFile(ctx: RunCtx, locale: string, name: string): string {
  return join(localeDateDir(ctx.sourcedataRoot, ctx.date, locale), name);
}

// --- glossary LLM-step output validators -----------------------------------

function validateDefinitionFills(raw: unknown, pendingTerms: string[]): {
  definitions: DefinitionFill[];
  refused: Array<{ term: string; reason: string }>;
} {
  const o = raw as any;
  if (!o || typeof o !== 'object') throw new Error('output is not an object');
  if (!Array.isArray(o.definitions)) throw new Error("missing 'definitions' array");
  if (!Array.isArray(o.refused)) throw new Error("missing 'refused' array");
  const seen = new Set<string>();
  for (const d of o.definitions) {
    for (const k of ['term', 'quick_def', 'why_it_matters',
      'quick_def_ja', 'quick_def_es', 'quick_def_fil',
      'why_it_matters_ja', 'why_it_matters_es', 'why_it_matters_fil'])
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

// ---------------------------------------------------------------------------
// 1_daily_update
// ---------------------------------------------------------------------------

export function dailyUpdateSteps(): StepDef[] {
  return [
    {
      id: 'compose-news-section', kind: 'llm',
      run: (ctx) => llmArtifactStep(ctx, {
        id: 'compose-news-section',
        artifact: sdFile(ctx, 'news_section.json'),
        validate: parseNewsSectionFile,
        webSearch: true,
        prompt: () => buildStepPrompt({
          skill: 'compose-news-section', date: ctx.date,
          writerRules: loadWriterRules('1_daily_update'),
          extra: [
            'Reference topic list: reference/news-topics.md in the news checkout '
            + '(search the trusted sources for the last 3 days; always include Unsloth).',
            `Existing citations to skip: see references.txt in the checkout.`,
          ].join('\n'),
          outputNote: 'the news_section.json document ({date, sections[]}).',
        }),
      }),
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
        validate: parseHeadlinesFile,
        prompt: () => buildStepPrompt({
          skill: 'compose-headlines-pair', date: ctx.date,
          writerRules: loadWriterRules('1_daily_update'),
          extra: `Today's news_section.json:\n`
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
        await Promise.all(NON_EN.map(async (L) => {
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
        }));
      },
    },
    {
      id: 'render-news', kind: 'det',
      run: (ctx) => {
        for (const L of LOCALES)
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
          seedYaml: join(ctx.newsRepo, REFERENCE_DIR, 'glossary.yml'),
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
            outputNote: '{"definitions": [{"term", "quick_def", "why_it_matters", '
              + '"quick_def_ja", "quick_def_es", "quick_def_fil", '
              + '"why_it_matters_ja", "why_it_matters_es", "why_it_matters_fil", '
              + '"canonical_link" (optional)}], "refused": [{"term", "reason"}]} — '
              + 'every pending term appears in exactly one of the two lists.',
          }),
          validate: (raw) => validateDefinitionFills(raw, pending.map(p => p.term)),
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
        for (const L of LOCALES) {
          const r = citationCheck({
            draft: newsOutputPath(ctx.newsRepo, ctx.date, L),
            policyFile: join(ctx.newsRepo, REFERENCE_DIR, 'citation-restrictions.md'),
            unclassifiedOut: L === 'en' && !ctx.replay
              ? join(ctx.newsRepo, REFERENCE_DIR, 'citation-policy-review.md') : null,
            todayIso: ctx.todayIso,
          });
          gateOrFail('citation-check-news', r, ctx);
        }
      },
    },
    {
      id: 'append-references', kind: 'det',
      run: (ctx) => {
        const refPath = join(ctx.newsRepo, REFERENCES_TXT);
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
        ctx.log(`  references.txt: +${deduped.length} new URL(s)`);
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
        }, ctx.date, pidByJsonId);
      },
    },
    {
      id: 'lint-news', kind: 'det',
      run: (ctx) => gateOrFail('lint-news', lintPaths(datePaths(ctx.newsRepo, ctx.date)), ctx),
    },
    {
      id: 'verify-topic-coverage', kind: 'llm',
      run: (ctx) => llmArtifactStep(ctx, {
        id: 'verify-topic-coverage',
        artifact: sdFile(ctx, 'verification.json'),
        validate: (raw: any) => {
          if (typeof raw !== 'object' || raw === null || !Array.isArray(raw.verifications))
            throw new Error('verification.json: expected {verifications: []}');
          return raw;
        },
        prompt: () => buildStepPrompt({
          skill: 'verify-topic-coverage', date: ctx.date,
          extra: `Today's news_section.json:\n`
            + readFileSync(sdFile(ctx, 'news_section.json'), 'utf8')
            + `\n\nTopic rubric: reference/news-topics.md in the news checkout.`,
          outputNote: 'the verification.json document ({date, verifications[]}).',
        }),
      }),
    },
    {
      id: 'check-topic-coverage', kind: 'det',
      run: (ctx) => gateOrFail('check-topic-coverage',
        checkTopicCoverage({ sourcedataDir: ctx.sourcedataRoot, date: ctx.date }), ctx),
    },
    {
      id: 'puv-news', kind: 'det',
      run: (ctx) => gateOrFail('puv-news', postUpdateValidation({
        check: 'news', date: ctx.date, db: ctx.dbFile,
        docsDataDir: docsDataDir(ctx.newsRepo), repoRoot: ctx.newsRepo,
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
        validate: parseBridgesFile,
        prompt: () => buildStepPrompt({
          skill: 'compose-validation-rows', date: ctx.date,
          writerRules: loadWriterRules('2_future_prediction'),
          extra: 'Inputs: report/en/news-*.md for the last 7 days and the '
            + 'latest memory/dormant snapshot in the news checkout. Fill the '
            + 'bridge narratives too (compose-bridge contract).',
          outputNote: 'the bridges.json document ({date, validation_rows[]}) with bridges filled.',
        }),
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
        await Promise.all(NON_EN.map(async (L) => {
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
        }));
      },
    },
    {
      id: 'render-fp', kind: 'det',
      run: (ctx) => {
        for (const L of LOCALES)
          renderAndWriteFp(ctx.sourcedataRoot, ctx.newsRepo, ctx.date, L);
      },
    },
    {
      id: 'citation-check-fp', kind: 'det',
      run: (ctx) => {
        for (const L of LOCALES) {
          const r = citationCheck({
            draft: fpOutputPath(ctx.newsRepo, ctx.date, L),
            policyFile: join(ctx.newsRepo, REFERENCE_DIR, 'citation-restrictions.md'),
            unclassifiedOut: L === 'en' && !ctx.replay
              ? join(ctx.newsRepo, REFERENCE_DIR, 'citation-policy-review.md') : null,
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
        }, ctx.date, pidByJsonId);
      },
    },
    {
      id: 'lint-fp', kind: 'det',
      run: (ctx) => gateOrFail('lint-fp', lintPaths(datePaths(ctx.newsRepo, ctx.date)), ctx),
    },
    {
      id: 'puv-fp', kind: 'det',
      run: (ctx) => gateOrFail('puv-fp', postUpdateValidation({
        check: 'future-prediction', date: ctx.date, db: ctx.dbFile,
        docsDataDir: docsDataDir(ctx.newsRepo), repoRoot: ctx.newsRepo,
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
        for (const L of ['', '.ja', '.es', '.fil']) {
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
          const res = await ctx.ai.chat(ctx.runtime, [{
            role: 'user',
            content: buildStepPrompt({
              skill: 'bindfs-safe-commit-push', date: ctx.date,
              extra: [
                `Rewrite README${L}.md as the 3-day window ending ${ctx.date} `
                + `for locale '${locSeg}' per design/scheduled/3_daily_briefing.md Step 2.`,
                `Current file:\n${prev}`,
                `Today's news file: report/${locSeg}/news-${ctx.date.replaceAll('-', '')}.md`,
                `Today's FP file: future-prediction/${locSeg}/future-prediction-${ctx.date.replaceAll('-', '')}.md`,
                'Reply with the FULL new README content, nothing else.',
              ].join('\n\n'),
              outputNote: 'the complete README markdown (not JSON).',
            }),
          }], { caller: `readme-window:${locSeg}` });
          if (!ctx.dryRun) writeFileSync(path, res.text.endsWith('\n') ? res.text : res.text + '\n');
        }
      },
    },
    {
      id: 'readme-checks', kind: 'det',
      run: (ctx) => {
        const link = checkReadmeLinks(ctx.newsRepo);
        for (const l of link.lines) ctx.log(`  ${l}`);
        if (link.exit !== 0) throw new StepFailure('readme-checks', 'link routing failed');
        const pwi = postWriteIntegrity('readme',
          ['', '.ja', '.es', '.fil'].map(L => join(ctx.newsRepo, `README${L}.md`)));
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
        const outDir = docsDataDir(ctx.newsRepo);
        runExport(ctx.db, { outputDir: outDir, publishRoot: ctx.newsRepo });
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
      id: 'dashboard-integrity', kind: 'det',
      run: (ctx) => {
        const assets = ['index.html', 'assets/app.js', 'assets/styles.css']
          .map(p => `${DOCS_DIR}/${p}`)
          .map(p => join(ctx.newsRepo, p))
          .filter(p => existsSync(p));
        if (assets.length)
          gateOrFail('dashboard-integrity', postWriteIntegrity('dashboard-asset', assets), ctx);
        const m = JSON.parse(readFileSync(join(docsDataDir(ctx.newsRepo), 'manifest.json'), 'utf8'));
        if ((m.locales ?? []).length !== 4 || m.default_locale !== 'en')
          throw new StepFailure('dashboard-integrity', 'manifest shape check failed');
      },
    },
    {
      id: 'puv-exports', kind: 'det',
      run: (ctx) => gateOrFail('puv-exports', postUpdateValidation({
        check: 'exports', date: ctx.date, db: ctx.dbFile,
        docsDataDir: docsDataDir(ctx.newsRepo), repoRoot: ctx.newsRepo,
      }), ctx),
    },
    {
      // DEVIATION: plain git — the bindfs /tmp-mirror workaround in
      // bindfs-safe-commit-push.sh was host-specific to the old setup.
      id: 'publish', kind: 'det',
      run: (ctx) => {
        if (ctx.dryRun || ctx.replay) {
          ctx.log('  publish skipped (dry-run/replay)');
          return;
        }
        const git = (...args: string[]) =>
          execFileSync('git', ['-C', ctx.newsRepo, ...args], { encoding: 'utf8' });
        git('add', 'README.md', ...NON_EN.map(l => `README.${l}.md`),
          `${DOCS_DIR}/data`, REPORT_DIR, FP_DIR, MEMORY_DIR, REFERENCES_TXT,
          `${REFERENCE_DIR}/citation-policy-review.md`, 'app/sourcedata');
        try {
          git('commit', '-m', `daily-master ${ctx.date}: news + future-prediction + 3-day README + dashboard`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (!msg.includes('nothing to commit')) throw e;
        }
        // Instances without a remote (sandboxes have origin removed by
        // design) publish locally only — the commit IS the publish.
        if (git('remote').trim() === '') {
          ctx.log('  no git remote — committed locally, push skipped');
          return;
        }
        git('push');
      },
    },
  ];
}
