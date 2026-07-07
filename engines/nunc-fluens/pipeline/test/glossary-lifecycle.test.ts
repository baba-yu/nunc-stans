// Unit coverage for the define/validate glossary live-path logic —
// the deterministic halves ported from define_glossary_terms.py and
// validate_glossary_terms.py. (The LLM fill/judge halves are prompt
// contracts; their output validators are exercised via the DB effects
// of commitDefinition / commitValidation here.)
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { schemaPath } from '../src/db/db.ts';
import {
  commitDefinition, pendingDefinitions, promoteEligible, retireQuiet,
  retireRefused,
} from '../src/ingest/glossary-define.ts';
import {
  commitValidation, dedupeCheck, formCheck, listPendingSemantic,
  runValidateGlossary,
} from '../src/gates/validate-glossary-terms.ts';

const TODAY = '2026-07-06';

let db: Database.Database;

function addTerm(over: Record<string, unknown> = {}): void {
  const row = {
    term: 'TurboQuant',
    aliases_json: '[]',
    quick_def: null,
    why_it_matters: null,
    status: 'candidate',
    first_seen_date: '2026-06-20',
    last_seen_date: '2026-07-01',
    occurrences_30d: 5,
    distinct_days_14d: 3,
    reviewed_by_human: 0,
    ...over,
  };
  db.prepare(
    `INSERT INTO glossary_terms (term, aliases_json, quick_def, why_it_matters,
       status, first_seen_date, last_seen_date, occurrences_30d,
       distinct_days_14d, reviewed_by_human)
     VALUES (@term, @aliases_json, @quick_def, @why_it_matters, @status,
       @first_seen_date, @last_seen_date, @occurrences_30d,
       @distinct_days_14d, @reviewed_by_human)`,
  ).run(row);
}

beforeEach(() => {
  db = new Database(':memory:');
  db.exec(readFileSync(schemaPath(), 'utf8'));
  db.prepare('DELETE FROM glossary_terms').run();
  db.prepare('DELETE FROM glossary_audit').run();
});

afterEach(() => db.close());

describe('define-glossary-terms (state flips)', () => {
  it('promotes candidates at the 14d threshold and lists them pending', () => {
    addTerm({ term: 'HotTerm', distinct_days_14d: 3 });
    addTerm({ term: 'ColdTerm', distinct_days_14d: 2 });
    expect(promoteEligible(db, TODAY)).toEqual(['HotTerm']);
    const status = (t: string) => (db.prepare(
      'SELECT status FROM glossary_terms WHERE term=?').get(t) as any).status;
    expect(status('HotTerm')).toBe('active');
    expect(status('ColdTerm')).toBe('candidate');
    expect(pendingDefinitions(db).map(p => p.term)).toEqual(['HotTerm']);
  });

  it('retires quiet actives but never human-reviewed rows', () => {
    addTerm({ term: 'Quiet', status: 'active', occurrences_30d: 0,
      last_seen_date: '2026-05-01' });
    addTerm({ term: 'Curated', status: 'active', occurrences_30d: 0,
      last_seen_date: '2026-05-01', reviewed_by_human: 1 });
    addTerm({ term: 'Fresh', status: 'active', occurrences_30d: 0,
      last_seen_date: '2026-06-30' });
    expect(retireQuiet(db, TODAY)).toEqual(['Quiet']);
  });

  it('commitDefinition writes EN + all locale columns', () => {
    addTerm({ term: 'X', status: 'active' });
    commitDefinition(db, TODAY, {
      term: 'X', quick_def: 'a thing', why_it_matters: 'it matters',
      quick_def_ja: 'ja', quick_def_es: 'es', quick_def_fil: 'fil',
      why_it_matters_ja: 'wja', why_it_matters_es: 'wes', why_it_matters_fil: 'wfil',
    });
    const r = db.prepare('SELECT * FROM glossary_terms WHERE term=?').get('X') as any;
    expect(r.quick_def).toBe('a thing');
    expect(r.quick_def_fil).toBe('fil');
    expect(r.why_it_matters_es).toBe('wes');
    expect(r.updated_at).toBe(TODAY);
  });

  it('retireRefused pins reviewed_by_human so the quiet rule never flaps it', () => {
    addTerm({ term: 'API', status: 'active' });
    retireRefused(db, TODAY, 'API');
    const r = db.prepare('SELECT status, reviewed_by_human FROM glossary_terms WHERE term=?')
      .get('API') as any;
    expect(r.status).toBe('retired');
    expect(r.reviewed_by_human).toBe(1);
  });
});

describe('validate-glossary-terms (form)', () => {
  const base = { term: 'MCP', aliases_json: '[]', quick_def: 'A protocol.',
    why_it_matters: 'Interop.', canonical_link: null };

  it('passes a clean row', () => {
    expect(formCheck(base).verdict).toBe('pass');
  });

  it('fails empty quick_def and generic terms', () => {
    expect(formCheck({ ...base, quick_def: '' }).verdict).toBe('fail');
    expect(formCheck({ ...base, term: 'Today' }).verdict).toBe('fail');
  });

  it('fails forbidden jargon, warns on length caps', () => {
    expect(formCheck({ ...base, quick_def: 'We leverage synergy.' }).verdict).toBe('fail');
    const long = Array.from({ length: 26 }, (_, i) => `w${i}`).join(' ');
    expect(formCheck({ ...base, quick_def: long }).verdict).toBe('warn');
    const threeSentences = 'One. Two. Three.';
    expect(formCheck({ ...base, quick_def: threeSentences }).verdict).toBe('warn');
  });
});

describe('validate-glossary-terms (dedupe + audit)', () => {
  it('fails when the term is an alias of another active term', () => {
    addTerm({ term: 'Model Context Protocol', status: 'active',
      aliases_json: '["MCP"]', quick_def: 'x' });
    addTerm({ term: 'MCP', status: 'active', quick_def: 'y' });
    const v = dedupeCheck(db, { term: 'MCP', aliases_json: '[]',
      quick_def: 'y', why_it_matters: null, canonical_link: null });
    expect(v.verdict).toBe('fail');
    expect(v.reason).toContain('Model Context Protocol');
  });

  it('warns on alias-overlap when the term is a substring of a longer term', () => {
    // Shared alias 'kvc' + substring relation, but the term itself is
    // NOT in the longer term's alias set → the conservative warn branch.
    addTerm({ term: 'KV-cache offloading', status: 'active',
      aliases_json: '["kvc"]', quick_def: 'x' });
    addTerm({ term: 'KV-cache', status: 'active',
      aliases_json: '["kvc"]', quick_def: 'y' });
    const v = dedupeCheck(db, { term: 'KV-cache', aliases_json: '["kvc"]',
      quick_def: 'y', why_it_matters: null, canonical_link: null });
    expect(v.verdict).toBe('warn');
  });

  it('a fail verdict retires the row and pins human review', () => {
    addTerm({ term: 'Today', status: 'active', quick_def: 'generic' });
    commitValidation(db, {
      term: 'Today', today: TODAY,
      verdicts: [{ check_type: 'form', verdict: 'fail', reason: 'generic term' }],
    });
    const r = db.prepare(
      'SELECT status, reviewed_by_human FROM glossary_terms WHERE term=?')
      .get('Today') as any;
    expect(r.status).toBe('retired');
    expect(r.reviewed_by_human).toBe(1);
    const audit = db.prepare(
      'SELECT check_type, verdict, checked_at FROM glossary_audit WHERE term=?')
      .get('Today') as any;
    expect(audit).toMatchObject({ check_type: 'form', verdict: 'fail', checked_at: TODAY });
  });

  it('semantic queue excludes pass/fail-audited rows, keeps warn (uncertain)', () => {
    addTerm({ term: 'A', status: 'active', quick_def: 'd' });
    addTerm({ term: 'B', status: 'active', quick_def: 'd' });
    addTerm({ term: 'C', status: 'active', quick_def: 'd' });
    commitValidation(db, { term: 'A', today: TODAY,
      verdicts: [{ check_type: 'semantic', verdict: 'pass', reason: '' }] });
    commitValidation(db, { term: 'B', today: TODAY,
      verdicts: [{ check_type: 'semantic', verdict: 'warn', reason: 'uncertain' }] });
    expect(listPendingSemantic(db).map(r => r.term)).toEqual(['B', 'C']);
  });

  it('runValidateGlossary audits every active row and reports the split', () => {
    addTerm({ term: 'Clean', status: 'active', quick_def: 'A fine def.',
      why_it_matters: 'ok' });
    addTerm({ term: 'Today', status: 'active', quick_def: 'generic word' });
    const s = runValidateGlossary(db, { today: TODAY });
    expect(s.checked).toBe(2);
    expect(s.retiredByFormOrDedupe).toEqual(['Today']);
    // Both rows got form+dedupe audit rows.
    const n = (db.prepare('SELECT COUNT(*) AS n FROM glossary_audit').get() as any).n;
    expect(n).toBe(4);
    // 'Clean' passed and is queued for the semantic judge.
    expect(s.pendingSemantic.map(r => r.term)).toEqual(['Clean']);
  });
});
