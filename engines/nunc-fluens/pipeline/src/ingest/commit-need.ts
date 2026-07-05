// TS port of app/skills/extract_needs.py::commit_need — persists Need +
// 5W1H task rows. (The LLM extraction lives in the orchestrator; the
// merge helper is ported with T5 when the DAG needs it.)
import type { Db } from './ingest-core.ts';
import { needHashId } from './util.ts';
import { parseTimeWindow } from './timewindow.ts';

export interface NeedRecord {
  actor?: string | null;
  job?: string | null;
  outcome?: string | null;
  motivation?: string | null;
  task?: Record<string, string | null> | null;
  [key: string]: unknown;
}

const CELLS = ['who', 'what', 'where', 'when', 'why', 'how'] as const;

function isComplete5w1h(task: Record<string, unknown> | null | undefined): boolean {
  const t = task ?? {};
  return ['who', 'what', 'where', 'when', 'why'].every(k => Boolean(t[k]));
}

export interface CommitNeedSummary {
  prediction_id: string;
  need_count: number;
  tasks_count: number;
  blocked: string[];
}

export function commitNeed(db: Db, args: {
  predictionId: string; needRecords: NeedRecord[]; todayIso: string;
}): CommitNeedSummary {
  const today = args.todayIso;
  const summary: CommitNeedSummary = {
    prediction_id: args.predictionId, need_count: 0, tasks_count: 0, blocked: [],
  };
  for (const rec of args.needRecords) {
    const actor = rec?.actor;
    if (!actor) continue;
    const needId = needHashId('need', args.predictionId, actor);
    const task = (rec.task ?? {}) as Record<string, string | null>;
    const [taskStart, taskEnd] = parseTimeWindow(task.when ?? '');
    const g = (k: string): unknown => (rec as Record<string, unknown>)[k] ?? null;
    db.prepare(
      `INSERT OR REPLACE INTO prediction_needs
         (need_id, prediction_id,
          actor, actor_ja, actor_es, actor_fil,
          job, job_ja, job_es, job_fil,
          outcome, outcome_ja, outcome_es, outcome_fil,
          motivation, motivation_ja, motivation_es, motivation_fil,
          target_start_date, target_end_date,
          reviewed_by_human, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`)
      .run(
        needId, args.predictionId,
        actor, g('actor_ja'), g('actor_es'), g('actor_fil'),
        rec.job ?? '', g('job_ja'), g('job_es'), g('job_fil'),
        g('outcome'), g('outcome_ja'), g('outcome_es'), g('outcome_fil'),
        g('motivation'), g('motivation_ja'), g('motivation_es'), g('motivation_fil'),
        taskStart, taskEnd, today);
    summary.need_count += 1;
    const taskId = needHashId('need_task', needId, (task.what ?? '') as string);
    const status = isComplete5w1h(task) ? 'open' : 'blocked';
    if (status === 'blocked') summary.blocked.push(taskId);
    const colNames: string[] = [];
    const colValues: unknown[] = [];
    for (const cell of CELLS) {
      for (const [suffix, key] of [['', cell], ['_ja', `${cell}_ja`], ['_es', `${cell}_es`], ['_fil', `${cell}_fil`]] as const) {
        colNames.push(`${cell}_text${suffix}`);
        colValues.push(task[key] ?? null);
      }
    }
    colNames.push('target_start_date', 'target_end_date');
    colValues.push(taskStart, taskEnd);
    const placeholders = Array(2 + colNames.length + 2).fill('?').join(', ');
    db.prepare(
      `INSERT OR REPLACE INTO needs_tasks
         (task_id, need_id, ${colNames.join(', ')}, status, updated_at)
       VALUES (${placeholders})`)
      .run(taskId, needId, ...colValues as never[], status, today);
    summary.tasks_count += 1;
  }
  return summary;
}
