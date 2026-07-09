// TS port of app/skills/sourcedata_schemas.py (the oracle validator).
// This module IS the canonical sourcedata schema — the frozen
// sourcedata-layout spec was retired with the design corpus (git
// history keeps it).
//
// Like the oracle, this deliberately avoids a schema-library dependency
// (zod/ajv): the Python side chose hand-rolled validators for error
// clarity, and porting them one-to-one keeps the error semantics —
// including message text — parity-comparable. Known, accepted
// divergences from Python (JSON-side pathologies only):
//   * Python's bool subclasses int, so `True` passes an int check there;
//     here it does not (typeName(true) = 'bool').
//   * JSON `1.0` is a float to Python but indistinguishable from int 1
//     in JS, so an int field holding `1.0` passes here, not there.
//   * Python str(2.0) renders '2.0' in range-error messages; JS renders '2'.

export class SourcedataValidationError extends Error {}

// ---------------------------------------------------------------------------
// Validation helpers (mirror _require/_optional/_require_list/_require_str)
// ---------------------------------------------------------------------------

type Kind = 'str' | 'int' | 'float' | 'dict' | 'list';

function typeName(v: unknown): string {
  if (v === null || v === undefined) return 'NoneType';
  if (Array.isArray(v)) return 'list';
  switch (typeof v) {
    case 'string': return 'str';
    case 'boolean': return 'bool';
    case 'number': return Number.isInteger(v) ? 'int' : 'float';
    case 'object': return 'dict';
    default: return typeof v;
  }
}

function matches(v: unknown, kind: Kind): boolean {
  switch (kind) {
    case 'str': return typeof v === 'string';
    case 'int': return typeof v === 'number' && Number.isInteger(v);
    case 'float': return typeof v === 'number';
    case 'dict': return typeof v === 'object' && v !== null && !Array.isArray(v);
    case 'list': return Array.isArray(v);
  }
}

function fail(msg: string): never {
  throw new SourcedataValidationError(msg);
}

function isDict(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Python repr() for the strings we interpolate into messages. */
function pyRepr(s: string): string {
  return `'${s.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

function pyTuple(items: readonly string[]): string {
  return `(${items.map(pyRepr).join(', ')})`;
}

function requireKey(d: unknown, key: string, kinds: readonly Kind[], path: string): unknown {
  if (!isDict(d)) fail(`${path}: expected object, got ${typeName(d)}`);
  if (!(key in d)) fail(`${path}: missing required key ${pyRepr(key)}`);
  const val = d[key];
  if (val !== null && val !== undefined && !kinds.some(k => matches(val, k)))
    fail(`${path}.${key}: expected ${kinds.join(', ')}, got ${typeName(val)}`);
  return val ?? null;
}

function optionalKey(d: Record<string, unknown>, key: string, kinds: readonly Kind[], path: string): unknown {
  if (!(key in d)) return null;
  const val = d[key];
  if (val === null || val === undefined) return null;
  if (!kinds.some(k => matches(val, k)))
    fail(`${path}.${key}: expected ${kinds.join(', ')}, got ${typeName(val)}`);
  return val;
}

function requireList(d: unknown, key: string, path: string): unknown[] {
  const val = requireKey(d, key, ['list'], path);
  if (val === null) fail(`${path}.${key}: must not be null`);
  return val as unknown[];
}

function requireStr(d: unknown, key: string, path: string): string {
  const val = requireKey(d, key, ['str'], path);
  if (val === null) fail(`${path}.${key}: must not be null`);
  return val as string;
}

function optionalStr(d: Record<string, unknown>, key: string, path: string): string | null {
  return optionalKey(d, key, ['str'], path) as string | null;
}

function strList(raw: unknown[], path: string, key: string): string[] {
  const out: string[] = [];
  raw.forEach((v, i) => {
    if (typeof v !== 'string')
      fail(`${path}.${key}[${i}]: expected str, got ${typeName(v)}`);
    out.push(v);
  });
  return out;
}

// ---------------------------------------------------------------------------
// predictions.json
// ---------------------------------------------------------------------------

export interface Reasoning {
  because: string;
  given: string;
  so_that: string;
  landing: string;
  plain_language: string;
}

function parseReasoning(d: unknown, path = 'reasoning'): Reasoning {
  return {
    because: requireStr(d, 'because', path),
    given: requireStr(d, 'given', path),
    so_that: requireStr(d, 'so_that', path),
    landing: requireStr(d, 'landing', path),
    plain_language: requireStr(d, 'plain_language', path),
  };
}

export interface PredictionEntry {
  id: string;
  title: string;
  body: string;
  reasoning: Reasoning;
  summary: string;
  scope_hint: string | null;
}

function parsePredictionEntry(d: unknown, path = 'predictions[]'): PredictionEntry {
  if (!isDict(d)) fail(`${path}: expected object, got ${typeName(d)}`);
  const reasoningRaw = requireKey(d, 'reasoning', ['dict'], path);
  return {
    id: requireStr(d, 'id', path),
    title: requireStr(d, 'title', path),
    body: requireStr(d, 'body', path),
    reasoning: parseReasoning(reasoningRaw, `${path}.reasoning`),
    summary: requireStr(d, 'summary', path),
    scope_hint: optionalStr(d, 'scope_hint', path),
  };
}

export function predictionEntryToDict(p: PredictionEntry): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: p.id, title: p.title, body: p.body,
    reasoning: { ...p.reasoning }, summary: p.summary,
  };
  if (p.scope_hint !== null) out.scope_hint = p.scope_hint;
  return out;
}

export interface PredictionsFile {
  date: string;
  predictions: PredictionEntry[];
}

export function parsePredictionsFile(d: unknown): PredictionsFile {
  const path = 'predictions.json';
  const date = requireStr(d, 'date', path);
  const predsRaw = requireList(d, 'predictions', path);
  return {
    date,
    predictions: predsRaw.map((p, i) => parsePredictionEntry(p, `${path}.predictions[${i}]`)),
  };
}

export function predictionsFileToDict(f: PredictionsFile): Record<string, unknown> {
  return { date: f.date, predictions: f.predictions.map(predictionEntryToDict) };
}

// ---------------------------------------------------------------------------
// needs.json
// ---------------------------------------------------------------------------

export interface NeedTask {
  who: string | null; what: string | null; where: string | null;
  when: string | null; why: string | null; how: string | null;
}

function parseNeedTask(d: unknown, path = 'task'): NeedTask {
  if (!isDict(d)) fail(`${path}: expected object, got ${typeName(d)}`);
  return {
    who: optionalStr(d, 'who', path),
    what: optionalStr(d, 'what', path),
    where: optionalStr(d, 'where', path),
    when: optionalStr(d, 'when', path),
    why: optionalStr(d, 'why', path),
    how: optionalStr(d, 'how', path),
  };
}

export function needTaskToDict(t: NeedTask): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of ['who', 'what', 'where', 'when', 'why', 'how'] as const)
    if (t[k] !== null) out[k] = t[k];
  return out;
}

export interface NeedEntry {
  actor: string;
  job: string;
  outcome: string | null;
  motivation: string | null;
  task: NeedTask | null;
}

function parseNeedEntry(d: unknown, path = 'needs[]'): NeedEntry {
  if (!isDict(d)) fail(`${path}: expected object, got ${typeName(d)}`);
  const taskRaw = optionalKey(d, 'task', ['dict'], path);
  return {
    actor: requireStr(d, 'actor', path),
    job: requireStr(d, 'job', path),
    outcome: optionalStr(d, 'outcome', path),
    motivation: optionalStr(d, 'motivation', path),
    task: taskRaw !== null ? parseNeedTask(taskRaw, `${path}.task`) : null,
  };
}

export function needEntryToDict(n: NeedEntry): Record<string, unknown> {
  const out: Record<string, unknown> = { actor: n.actor, job: n.job };
  if (n.outcome !== null) out.outcome = n.outcome;
  if (n.motivation !== null) out.motivation = n.motivation;
  if (n.task !== null) out.task = needTaskToDict(n.task);
  return out;
}

export interface NeedsFile {
  date: string;
  by_prediction: Record<string, NeedEntry[]>;
}

export function parseNeedsFile(d: unknown): NeedsFile {
  const path = 'needs.json';
  const date = requireStr(d, 'date', path);
  const byPredRaw = requireKey(d, 'by_prediction', ['dict'], path);
  if (byPredRaw === null) fail(`${path}.by_prediction: must not be null`);
  const byPred: Record<string, NeedEntry[]> = {};
  for (const [pid, needsList] of Object.entries(byPredRaw as Record<string, unknown>)) {
    const subPath = `${path}.by_prediction[${pyRepr(pid)}]`;
    if (!Array.isArray(needsList))
      fail(`${subPath}: expected list, got ${typeName(needsList)}`);
    byPred[pid] = needsList.map((n, i) => parseNeedEntry(n, `${subPath}[${i}]`));
  }
  return { date, by_prediction: byPred };
}

export function needsFileToDict(f: NeedsFile): Record<string, unknown> {
  return {
    date: f.date,
    by_prediction: Object.fromEntries(
      Object.entries(f.by_prediction).map(([pid, needs]) => [pid, needs.map(needEntryToDict)])),
  };
}

// ---------------------------------------------------------------------------
// bridges.json
// ---------------------------------------------------------------------------

export interface ReferenceLink { label: string; url: string }

function parseReferenceLink(d: unknown, path = 'reference_links[]'): ReferenceLink {
  if (!isDict(d)) fail(`${path}: expected object, got ${typeName(d)}`);
  return { label: requireStr(d, 'label', path), url: requireStr(d, 'url', path) };
}

export interface PredictionRef { id: string; short_label: string; prediction_date: string }

function parsePredictionRef(d: unknown, path = 'prediction_ref'): PredictionRef {
  if (!isDict(d)) fail(`${path}: expected object, got ${typeName(d)}`);
  return {
    id: requireStr(d, 'id', path),
    short_label: requireStr(d, 'short_label', path),
    prediction_date: requireStr(d, 'prediction_date', path),
  };
}

export const SUPPORT_DIMENSIONS = ['because', 'given', 'so_that', 'landing', 'none'] as const;

export interface Bridge {
  support_dimension: string;
  narrative: string;
  coherence: number;
  remaining_gap: string;
}

function parseBridge(d: unknown, path = 'bridge'): Bridge {
  if (!isDict(d)) fail(`${path}: expected object, got ${typeName(d)}`);
  const sd = requireStr(d, 'support_dimension', path);
  if (!(SUPPORT_DIMENSIONS as readonly string[]).includes(sd))
    fail(`${path}.support_dimension: must be one of ${pyTuple(SUPPORT_DIMENSIONS)}, got ${pyRepr(sd)}`);
  const coh = requireKey(d, 'coherence', ['int'], path);
  if (coh === null) fail(`${path}.coherence: must not be null`);
  return {
    support_dimension: sd,
    narrative: requireStr(d, 'narrative', path),
    coherence: coh as number,
    remaining_gap: requireStr(d, 'remaining_gap', path),
  };
}

export interface ValidationRowEntry {
  prediction_ref: PredictionRef;
  today_relevance: number;
  evidence_summary: string;
  reference_links: ReferenceLink[];
  bridge: Bridge;
}

function parseValidationRowEntry(d: unknown, path = 'validation_rows[]'): ValidationRowEntry {
  if (!isDict(d)) fail(`${path}: expected object, got ${typeName(d)}`);
  const predRefRaw = requireKey(d, 'prediction_ref', ['dict'], path);
  const rel = requireKey(d, 'today_relevance', ['int'], path);
  if (rel === null) fail(`${path}.today_relevance: must not be null`);
  const refsRaw = requireList(d, 'reference_links', path);
  const bridgeRaw = requireKey(d, 'bridge', ['dict'], path);
  return {
    prediction_ref: parsePredictionRef(predRefRaw, `${path}.prediction_ref`),
    today_relevance: rel as number,
    evidence_summary: requireStr(d, 'evidence_summary', path),
    reference_links: refsRaw.map((r, i) => parseReferenceLink(r, `${path}.reference_links[${i}]`)),
    bridge: parseBridge(bridgeRaw, `${path}.bridge`),
  };
}

export function validationRowEntryToDict(v: ValidationRowEntry): Record<string, unknown> {
  return {
    prediction_ref: { ...v.prediction_ref },
    today_relevance: v.today_relevance,
    evidence_summary: v.evidence_summary,
    reference_links: v.reference_links.map(r => ({ ...r })),
    bridge: { ...v.bridge },
  };
}

export interface BridgesFile {
  date: string;
  validation_rows: ValidationRowEntry[];
}

export function parseBridgesFile(d: unknown): BridgesFile {
  const path = 'bridges.json';
  const date = requireStr(d, 'date', path);
  const rowsRaw = requireList(d, 'validation_rows', path);
  return {
    date,
    validation_rows: rowsRaw.map((r, i) => parseValidationRowEntry(r, `${path}.validation_rows[${i}]`)),
  };
}

export function bridgesFileToDict(f: BridgesFile): Record<string, unknown> {
  return { date: f.date, validation_rows: f.validation_rows.map(validationRowEntryToDict) };
}

// ---------------------------------------------------------------------------
// headlines.json
// ---------------------------------------------------------------------------

export interface TechnicalHeadline {
  lead: string;
  body: string;
  citations: ReferenceLink[];
}

function parseTechnicalHeadline(d: unknown, path = 'technical[]'): TechnicalHeadline {
  if (!isDict(d)) fail(`${path}: expected object, got ${typeName(d)}`);
  const citesRaw = (optionalKey(d, 'citations', ['list'], path) ?? []) as unknown[];
  return {
    lead: requireStr(d, 'lead', path),
    body: requireStr(d, 'body', path),
    citations: citesRaw.map((c, i) => parseReferenceLink(c, `${path}.citations[${i}]`)),
  };
}

export interface HeadlinesFile {
  date: string;
  technical: TechnicalHeadline[];
  plain: string[];
}

export function parseHeadlinesFile(d: unknown): HeadlinesFile {
  const path = 'headlines.json';
  const date = requireStr(d, 'date', path);
  const techRaw = requireList(d, 'technical', path);
  const plainRaw = requireList(d, 'plain', path);
  const technical = techRaw.map((t, i) => parseTechnicalHeadline(t, `${path}.technical[${i}]`));
  const plain: string[] = [];
  plainRaw.forEach((p, i) => {
    if (typeof p !== 'string') fail(`${path}.plain[${i}]: expected str, got ${typeName(p)}`);
    plain.push(p);
  });
  return { date, technical, plain };
}

export function headlinesFileToDict(f: HeadlinesFile): Record<string, unknown> {
  return {
    date: f.date,
    technical: f.technical.map(t => ({
      lead: t.lead, body: t.body, citations: t.citations.map(c => ({ ...c })),
    })),
    plain: [...f.plain],
  };
}

// ---------------------------------------------------------------------------
// change_log.json
// ---------------------------------------------------------------------------

export const CHANGE_LOG_KINDS = ['new', 'updated', 'continuing'] as const;

export interface ChangeLogItem {
  kind: string;
  headline: string;
  diff_narrative: string;
}

function parseChangeLogItem(d: unknown, path = 'items[]'): ChangeLogItem {
  if (!isDict(d)) fail(`${path}: expected object, got ${typeName(d)}`);
  const kind = requireStr(d, 'kind', path);
  if (!(CHANGE_LOG_KINDS as readonly string[]).includes(kind))
    fail(`${path}.kind: must be one of ${pyTuple(CHANGE_LOG_KINDS)}, got ${pyRepr(kind)}`);
  return {
    kind,
    headline: requireStr(d, 'headline', path),
    diff_narrative: requireStr(d, 'diff_narrative', path),
  };
}

export interface ChangeLogFile {
  date: string;
  vs_date: string;
  items: ChangeLogItem[];
}

export function parseChangeLogFile(d: unknown): ChangeLogFile {
  const path = 'change_log.json';
  const date = requireStr(d, 'date', path);
  const vsDate = requireStr(d, 'vs_date', path);
  const itemsRaw = requireList(d, 'items', path);
  return {
    date, vs_date: vsDate,
    items: itemsRaw.map((it, i) => parseChangeLogItem(it, `${path}.items[${i}]`)),
  };
}

export function changeLogFileToDict(f: ChangeLogFile): Record<string, unknown> {
  return { date: f.date, vs_date: f.vs_date, items: f.items.map(it => ({ ...it })) };
}

// ---------------------------------------------------------------------------
// news_section.json
// ---------------------------------------------------------------------------

export interface NewsBullet {
  body: string;
  citations: ReferenceLink[];
}

function parseNewsBullet(d: unknown, path = 'bullets[]'): NewsBullet {
  if (!isDict(d)) fail(`${path}: expected object, got ${typeName(d)}`);
  const citesRaw = (optionalKey(d, 'citations', ['list'], path) ?? []) as unknown[];
  return {
    body: requireStr(d, 'body', path),
    citations: citesRaw.map((c, i) => parseReferenceLink(c, `${path}.citations[${i}]`)),
  };
}

export interface NewsSection {
  category: string;
  bullets: NewsBullet[];
}

function parseNewsSection(d: unknown, path = 'sections[]'): NewsSection {
  if (!isDict(d)) fail(`${path}: expected object, got ${typeName(d)}`);
  const bulletsRaw = requireList(d, 'bullets', path);
  return {
    category: requireStr(d, 'category', path),
    bullets: bulletsRaw.map((b, i) => parseNewsBullet(b, `${path}.bullets[${i}]`)),
  };
}

export interface NewsSectionFile {
  date: string;
  sections: NewsSection[];
}

export function parseNewsSectionFile(d: unknown): NewsSectionFile {
  const path = 'news_section.json';
  const date = requireStr(d, 'date', path);
  const secsRaw = requireList(d, 'sections', path);
  return {
    date,
    sections: secsRaw.map((s, i) => parseNewsSection(s, `${path}.sections[${i}]`)),
  };
}

export function newsSectionFileToDict(f: NewsSectionFile): Record<string, unknown> {
  return {
    date: f.date,
    sections: f.sections.map(s => ({
      category: s.category,
      bullets: s.bullets.map(b => ({ body: b.body, citations: b.citations.map(c => ({ ...c })) })),
    })),
  };
}

// ---------------------------------------------------------------------------
// readings.json (chain edges + relations + cluster pointers)
// ---------------------------------------------------------------------------

export interface ChainEdge {
  source_prediction_id: string;
  downstream_prediction_id: string;
  via_evidence_id: string | null;
  strength: number;
  notes: string | null;
}

function parseChainEdge(d: unknown, path = 'chain_edges[]'): ChainEdge {
  if (!isDict(d)) fail(`${path}: expected object, got ${typeName(d)}`);
  const strength = requireKey(d, 'strength', ['int', 'float'], path);
  if (strength === null) fail(`${path}.strength: must not be null`);
  const s = strength as number;
  if (!(s >= 0 && s <= 1)) fail(`${path}.strength: must be in [0, 1], got ${s}`);
  return {
    source_prediction_id: requireStr(d, 'source_prediction_id', path),
    downstream_prediction_id: requireStr(d, 'downstream_prediction_id', path),
    via_evidence_id: optionalStr(d, 'via_evidence_id', path),
    strength: s,
    notes: optionalStr(d, 'notes', path),
  };
}

export const RELATION_TYPES = [
  'parallel', 'exclusive_variant', 'negation', 'entails', 'equivalent',
] as const;

export interface Relation {
  prediction_a: string;
  prediction_b: string;
  relation_type: string;
  family_id: string | null;
  prob_mass: number | null;
  notes: string | null;
}

function parseRelation(d: unknown, path = 'relations[]'): Relation {
  if (!isDict(d)) fail(`${path}: expected object, got ${typeName(d)}`);
  const rt = requireStr(d, 'relation_type', path);
  if (!(RELATION_TYPES as readonly string[]).includes(rt))
    fail(`${path}.relation_type: must be one of ${pyTuple(RELATION_TYPES)}, got ${pyRepr(rt)}`);
  const pmRaw = optionalKey(d, 'prob_mass', ['int', 'float'], path);
  let pm: number | null = null;
  if (pmRaw !== null) {
    pm = pmRaw as number;
    if (!(pm >= 0 && pm <= 1)) fail(`${path}.prob_mass: must be in [0, 1], got ${pm}`);
  }
  return {
    prediction_a: requireStr(d, 'prediction_a', path),
    prediction_b: requireStr(d, 'prediction_b', path),
    relation_type: rt,
    family_id: optionalStr(d, 'family_id', path),
    prob_mass: pm,
    notes: optionalStr(d, 'notes', path),
  };
}

export interface ClusterPointer {
  prediction_id: string;
  cluster_keys: string[];
}

function parseClusterPointer(d: unknown, path = 'cluster_pointers[]'): ClusterPointer {
  if (!isDict(d)) fail(`${path}: expected object, got ${typeName(d)}`);
  const keysRaw = requireList(d, 'cluster_keys', path);
  return {
    prediction_id: requireStr(d, 'prediction_id', path),
    cluster_keys: strList(keysRaw, path, 'cluster_keys'),
  };
}

export interface ReadingsFile {
  date: string;
  chain_edges: ChainEdge[];
  relations: Relation[];
  cluster_pointers: ClusterPointer[];
}

export function parseReadingsFile(d: unknown): ReadingsFile {
  const path = 'readings.json';
  const date = requireStr(d, 'date', path);
  const edgesRaw = requireList(d, 'chain_edges', path);
  const relsRaw = requireList(d, 'relations', path);
  const cpsRaw = requireList(d, 'cluster_pointers', path);
  return {
    date,
    chain_edges: edgesRaw.map((e, i) => parseChainEdge(e, `${path}.chain_edges[${i}]`)),
    relations: relsRaw.map((r, i) => parseRelation(r, `${path}.relations[${i}]`)),
    cluster_pointers: cpsRaw.map((c, i) => parseClusterPointer(c, `${path}.cluster_pointers[${i}]`)),
  };
}

export function readingsFileToDict(f: ReadingsFile): Record<string, unknown> {
  return {
    date: f.date,
    chain_edges: f.chain_edges.map(e => ({ ...e })),
    relations: f.relations.map(r => ({ ...r })),
    cluster_pointers: f.cluster_pointers.map(c => ({
      prediction_id: c.prediction_id, cluster_keys: [...c.cluster_keys],
    })),
  };
}

// ---------------------------------------------------------------------------
// maintenance-candidates.json (Sunday — 6_weekly_maintenance Step 0)
// ---------------------------------------------------------------------------

export interface MaintenanceCandidatePrediction {
  prediction_id: string;
  change_signals: string[];
  confidence_drift_score: number;
}

function parseMaintenanceCandidatePrediction(
  d: unknown, path = 'predictions[]',
): MaintenanceCandidatePrediction {
  if (!isDict(d)) fail(`${path}: expected object, got ${typeName(d)}`);
  const signalsRaw = requireList(d, 'change_signals', path);
  const signals = strList(signalsRaw, path, 'change_signals');
  const score = requireKey(d, 'confidence_drift_score', ['int', 'float'], path);
  if (score === null) fail(`${path}.confidence_drift_score: must not be null`);
  return {
    prediction_id: requireStr(d, 'prediction_id', path),
    change_signals: signals,
    confidence_drift_score: score as number,
  };
}

export interface MaintenanceCandidateGlossaryTerm {
  term_id: string;
  ttl_expired_days: number;
}

function parseMaintenanceCandidateGlossaryTerm(
  d: unknown, path = 'glossary_terms[]',
): MaintenanceCandidateGlossaryTerm {
  if (!isDict(d)) fail(`${path}: expected object, got ${typeName(d)}`);
  const ttl = requireKey(d, 'ttl_expired_days', ['int'], path);
  if (ttl === null) fail(`${path}.ttl_expired_days: must not be null`);
  return { term_id: requireStr(d, 'term_id', path), ttl_expired_days: ttl as number };
}

export interface MaintenanceCandidatesFile {
  week_ending: string;
  predictions: MaintenanceCandidatePrediction[];
  glossary_terms: MaintenanceCandidateGlossaryTerm[];
}

export function parseMaintenanceCandidatesFile(d: unknown): MaintenanceCandidatesFile {
  const path = 'maintenance-candidates.json';
  const weekEnding = requireStr(d, 'week_ending', path);
  const predsRaw = requireList(d, 'predictions', path);
  const glossRaw = requireList(d, 'glossary_terms', path);
  return {
    week_ending: weekEnding,
    predictions: predsRaw.map((p, i) =>
      parseMaintenanceCandidatePrediction(p, `${path}.predictions[${i}]`)),
    glossary_terms: glossRaw.map((g, i) =>
      parseMaintenanceCandidateGlossaryTerm(g, `${path}.glossary_terms[${i}]`)),
  };
}

export function maintenanceCandidatesFileToDict(f: MaintenanceCandidatesFile): Record<string, unknown> {
  return {
    week_ending: f.week_ending,
    predictions: f.predictions.map(p => ({
      prediction_id: p.prediction_id,
      change_signals: [...p.change_signals],
      confidence_drift_score: p.confidence_drift_score,
    })),
    glossary_terms: f.glossary_terms.map(g => ({ ...g })),
  };
}

// ---------------------------------------------------------------------------
// maintenance-judgements.json (Sunday — 6_weekly_maintenance Step 1)
// ---------------------------------------------------------------------------

export const MAINTENANCE_STREAMS = ['reasoning', 'bridge', 'needs', 'readings', 'glossary'] as const;
export const MAINTENANCE_VERDICTS = ['fresh', 'stale', 'broken', 'retire'] as const;
export const MAINTENANCE_ACTIONS = ['rewrite', 'retire', 'noop'] as const;

export interface MaintenanceJudgement {
  prediction_id: string;
  stream: string;
  entry_id: string;
  verdict: string;
  reason: string;
  cross_stream_evidence: string[];
  proposed_action: string;
  confidence: number;
}

export function parseMaintenanceJudgement(d: unknown, path = 'judgements[]'): MaintenanceJudgement {
  if (!isDict(d)) fail(`${path}: expected object, got ${typeName(d)}`);
  const stream = requireStr(d, 'stream', path);
  if (!(MAINTENANCE_STREAMS as readonly string[]).includes(stream))
    fail(`${path}.stream: must be one of ${pyTuple(MAINTENANCE_STREAMS)}, got ${pyRepr(stream)}`);
  const verdict = requireStr(d, 'verdict', path);
  if (!(MAINTENANCE_VERDICTS as readonly string[]).includes(verdict))
    fail(`${path}.verdict: must be one of ${pyTuple(MAINTENANCE_VERDICTS)}, got ${pyRepr(verdict)}`);
  const action = requireStr(d, 'proposed_action', path);
  if (!(MAINTENANCE_ACTIONS as readonly string[]).includes(action))
    fail(`${path}.proposed_action: must be one of ${pyTuple(MAINTENANCE_ACTIONS)}, got ${pyRepr(action)}`);
  const cseRaw = requireList(d, 'cross_stream_evidence', path);
  const cse = strList(cseRaw, path, 'cross_stream_evidence');
  const conf = requireKey(d, 'confidence', ['int', 'float'], path);
  if (conf === null) fail(`${path}.confidence: must not be null`);
  return {
    prediction_id: requireStr(d, 'prediction_id', path),
    stream,
    entry_id: requireStr(d, 'entry_id', path),
    verdict,
    reason: requireStr(d, 'reason', path),
    cross_stream_evidence: cse,
    proposed_action: action,
    confidence: conf as number,
  };
}

export interface MaintenanceJudgementsFile {
  week_ending: string;
  judgements: MaintenanceJudgement[];
}

export function parseMaintenanceJudgementsFile(d: unknown): MaintenanceJudgementsFile {
  const path = 'maintenance-judgements.json';
  const weekEnding = requireStr(d, 'week_ending', path);
  const jRaw = requireList(d, 'judgements', path);
  return {
    week_ending: weekEnding,
    judgements: jRaw.map((j, i) => parseMaintenanceJudgement(j, `${path}.judgements[${i}]`)),
  };
}

export function maintenanceJudgementsFileToDict(f: MaintenanceJudgementsFile): Record<string, unknown> {
  return {
    week_ending: f.week_ending,
    judgements: f.judgements.map(j => ({
      prediction_id: j.prediction_id,
      stream: j.stream,
      entry_id: j.entry_id,
      verdict: j.verdict,
      reason: j.reason,
      cross_stream_evidence: [...j.cross_stream_evidence],
      proposed_action: j.proposed_action,
      confidence: j.confidence,
    })),
  };
}

// ---------------------------------------------------------------------------
// Registry — the canonical per-file dispatch
// ---------------------------------------------------------------------------

export interface FileSchema {
  parse: (d: unknown) => unknown;
  toDict: (v: never) => Record<string, unknown>;
}

export const CANONICAL_FILES: Record<string, FileSchema> = {
  'predictions.json': { parse: parsePredictionsFile, toDict: predictionsFileToDict as FileSchema['toDict'] },
  'needs.json': { parse: parseNeedsFile, toDict: needsFileToDict as FileSchema['toDict'] },
  'bridges.json': { parse: parseBridgesFile, toDict: bridgesFileToDict as FileSchema['toDict'] },
  'headlines.json': { parse: parseHeadlinesFile, toDict: headlinesFileToDict as FileSchema['toDict'] },
  'change_log.json': { parse: parseChangeLogFile, toDict: changeLogFileToDict as FileSchema['toDict'] },
  'news_section.json': { parse: parseNewsSectionFile, toDict: newsSectionFileToDict as FileSchema['toDict'] },
  'readings.json': { parse: parseReadingsFile, toDict: readingsFileToDict as FileSchema['toDict'] },
  'maintenance-candidates.json': { parse: parseMaintenanceCandidatesFile, toDict: maintenanceCandidatesFileToDict as FileSchema['toDict'] },
  'maintenance-judgements.json': { parse: parseMaintenanceJudgementsFile, toDict: maintenanceJudgementsFileToDict as FileSchema['toDict'] },
};
