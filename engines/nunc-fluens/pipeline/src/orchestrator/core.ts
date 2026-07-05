/* eslint-disable @typescript-eslint/no-explicit-any */
// Orchestrator core: run context, the run.json manifest (S-3's "which
// pair produced this day"), and the generic LLM-step machinery
// (prompt from the frozen skill specs + schema validation + one
// re-prompt + replay-from-stored-artifact).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type Database from 'better-sqlite3';
import type { Ai } from 'nunc-ai';

export interface RunCtx {
  date: string;
  /** 0 = Sunday (the DOW table branches on this). */
  dow: number;
  dataDir: string;
  /** The news data+publish checkout — inputs and published outputs. */
  newsRepo: string;
  sourcedataRoot: string;
  dbFile: string;
  db: Database.Database;
  /** null in replay mode — steps must never reach for it. */
  ai: Ai | null;
  runtime: string;
  search: string;
  synthModel: string | null;
  replay: boolean;
  dryRun: boolean;
  todayIso: string;
  log: (s: string) => void;
  manifest: RunManifest;
}

export interface StepRecord {
  id: string;
  task: string;
  kind: 'llm' | 'det';
  status: 'ok' | 'replayed' | 'skipped' | 'failed';
  durationMs: number;
  detail?: string;
}

export class RunManifest {
  readonly data: Record<string, any>;
  constructor(args: {
    date: string; mode: string; runtime: string; search: string; synthModel: string | null;
  }) {
    this.data = {
      date: args.date,
      mode: args.mode,
      runtime: args.runtime,
      search: args.search,
      synth_model: args.synthModel,
      started_at: new Date().toISOString(),
      finished_at: null,
      steps: [] as StepRecord[],
    };
  }
  record(rec: StepRecord): void {
    this.data.steps.push(rec);
  }
  finish(): void {
    this.data.finished_at = new Date().toISOString();
  }
  write(sourcedataRoot: string, date: string): string {
    const path = join(sourcedataRoot, date, 'run.json');
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(this.data, null, 2) + '\n', 'utf8');
    return path;
  }
}

export interface StepDef {
  id: string;
  kind: 'llm' | 'det';
  run: (ctx: RunCtx) => Promise<unknown> | unknown;
}

export class StepFailure extends Error {
  constructor(stepId: string, message: string) {
    super(`step ${stepId}: ${message}`);
  }
}

// --- prompt assets ---------------------------------------------------------

/** The frozen spec corpus imported at T0 — the prompts' source of truth. */
export function designDir(): string {
  return join(import.meta.dirname, '..', '..', '..', 'design');
}

export function loadSkillSpec(name: string): string {
  return readFileSync(join(designDir(), 'skills', `${name}.md`), 'utf8');
}

export function loadWriterRules(task: '1_daily_update' | '2_future_prediction'): string {
  return readFileSync(join(designDir(), 'scheduled', `${task}-writer-rules.md`), 'utf8');
}

/** Compose a single headless prompt for an LLM step: the skill spec is
 * the contract; the framing pins date, output shape, and "JSON only". */
export function buildStepPrompt(args: {
  skill: string;
  date: string;
  extra?: string;
  writerRules?: string;
  outputNote: string;
}): string {
  const parts = [
    `You are one step of the nunc-fluens daily news pipeline, run headlessly.`,
    `Today's date: ${args.date}.`,
    ``,
    `Follow this skill contract exactly:`,
    `--- SKILL SPEC (${args.skill}) ---`,
    loadSkillSpec(args.skill),
    `--- END SKILL SPEC ---`,
  ];
  if (args.writerRules) {
    parts.push('', '--- WRITER RULES ---', args.writerRules, '--- END WRITER RULES ---');
  }
  if (args.extra) parts.push('', args.extra);
  parts.push(
    '',
    `OUTPUT: ${args.outputNote}`,
    `Reply with ONLY the JSON document — no prose, no markdown fences.`,
  );
  return parts.join('\n');
}

/** Tolerant JSON extraction: raw JSON, or the largest fenced block. */
export function extractJson(text: string): unknown {
  const t = text.trim();
  try {
    return JSON.parse(t);
  } catch { /* try fenced */ }
  const fence = /```(?:json)?\s*([\s\S]*?)```/g;
  let best: string | null = null;
  for (const m of t.matchAll(fence))
    if (best === null || m[1].length > best.length) best = m[1];
  if (best !== null) return JSON.parse(best.trim());
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start !== -1 && end > start) return JSON.parse(t.slice(start, end + 1));
  throw new Error('no JSON found in model reply');
}

/** Generic LLM step: replay reads + validates the stored artifact; live
 * calls the runtime, validates, re-prompts once with the error, writes. */
export async function llmArtifactStep(ctx: RunCtx, args: {
  id: string;
  artifact: string;
  /** validate returns the canonical object or throws. */
  validate: (raw: unknown) => unknown;
  prompt: () => string;
  webSearch?: boolean;
  /** Post-process the model JSON before writing (e.g. merge). */
  finalize?: (parsed: unknown) => unknown;
}): Promise<'ok' | 'replayed'> {
  if (existsSync(args.artifact)) {
    args.validate(JSON.parse(readFileSync(args.artifact, 'utf8')));
    return 'replayed';
  }
  if (ctx.replay)
    throw new StepFailure(args.id,
      `replay requires stored artifact ${args.artifact} — not found`);
  if (ctx.ai === null)
    throw new StepFailure(args.id, 'no AI runtime configured');
  const prompt = args.prompt();
  let lastErr = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await ctx.ai.chat(ctx.runtime, [{
      role: 'user',
      content: attempt === 0 ? prompt
        : `${prompt}\n\nYour previous reply failed validation: ${lastErr}\nEmit corrected JSON only.`,
    }], {
      caller: args.id,
      webSearch: args.webSearch ?? false,
      model: ctx.synthModel ?? undefined,
    });
    try {
      let parsed = extractJson(res.text);
      if (args.finalize) parsed = args.finalize(parsed);
      args.validate(parsed);
      mkdirSync(dirname(args.artifact), { recursive: true });
      writeFileSync(args.artifact, JSON.stringify(parsed, null, 2) + '\n', 'utf8');
      return 'ok';
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  throw new StepFailure(args.id, `model output failed validation twice: ${lastErr}`);
}
