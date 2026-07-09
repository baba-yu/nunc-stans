// Prompt-asset resolution guard: the orchestrator reads pipeline/prompts/
// at RUN TIME as LLM prompt sources, and nothing else in the suite ever
// touches those reads (replay short-circuits before prompt building) —
// so a broken promptsDir() or a mis-moved file passes the full suite and
// only fails on the next live run. This test pins every runtime load.
import { describe, expect, it } from 'vitest';
import {
  buildStepPrompt, loadMemoryPolicy, loadScheduledSpec, loadSkillSpec,
  loadWriterRules, skillSpecForPrompt,
} from '../src/orchestrator/core.ts';

// Every skill spec loaded via buildStepPrompt({skill: ...}) somewhere in
// steps.ts / steps-sunday.ts, plus the calques rider (locale-fanout's
// contract mandates it; appended by skillSpecForPrompt).
const RUNTIME_SKILLS = [
  'apply-maintenance-update',
  'compose-change-log',
  'compose-headlines-pair',
  'compose-maintenance-judgement',
  'compose-news-section',
  'compose-prediction',
  'compose-validation-rows',
  'define-glossary-terms',
  'extract-needs',
  'locale-fanout',
  'locale-fanout-calques',
  'validate-glossary-terms',
  'verify-topic-coverage',
];

describe('runtime prompt assets resolve', () => {
  for (const name of RUNTIME_SKILLS) {
    it(`loadSkillSpec('${name}') is non-empty`, () => {
      expect(loadSkillSpec(name).trim().length).toBeGreaterThan(0);
    });
  }

  it('loadWriterRules resolves both tasks non-empty', () => {
    expect(loadWriterRules('1_daily_update').trim().length).toBeGreaterThan(0);
    expect(loadWriterRules('2_future_prediction').trim().length).toBeGreaterThan(0);
  });

  it("loadScheduledSpec('3_daily_briefing') is non-empty", () => {
    expect(loadScheduledSpec('3_daily_briefing').trim().length).toBeGreaterThan(0);
  });

  it('loadMemoryPolicy resolves and keeps the prompt-split marker', () => {
    const policy = loadMemoryPolicy();
    expect(policy.trim().length).toBeGreaterThan(0);
    // steps-sunday.ts splits the Sunday theme-review prompt on this exact
    // literal — renaming the heading silently swaps in the whole file.
    expect(policy).toContain('## 2. Taxonomy maintenance');
  });
});

describe('no dead self-referential prompt paths', () => {
  // The prompts were re-homed out of design/ (post-C), and the whole
  // engine design/ corpus (archive, ADRs, sourcedata-layout) was
  // retired 2026-07-07 — a design/ path in a runtime prompt is dead by
  // construction now. Moved files are cited at prompts/..., living
  // contracts at pipeline/src/....
  const DEAD_HOME = /\bdesign\//;

  it('no runtime-loaded prompt cites the retired design/ corpus', () => {
    for (const name of RUNTIME_SKILLS)
      expect(loadSkillSpec(name), name).not.toMatch(DEAD_HOME);
    expect(loadWriterRules('1_daily_update')).not.toMatch(DEAD_HOME);
    expect(loadWriterRules('2_future_prediction')).not.toMatch(DEAD_HOME);
    expect(loadScheduledSpec('3_daily_briefing')).not.toMatch(DEAD_HOME);
    expect(loadMemoryPolicy()).not.toMatch(DEAD_HOME);
  });
});

describe('locale-fanout prompt carries the calque rules', () => {
  // A distinctive string from locale-fanout-calques.md line 1.
  const CALQUES_MARKER = 'calque-avoidance reference';

  it('skillSpecForPrompt appends the calques file to locale-fanout only', () => {
    expect(skillSpecForPrompt('locale-fanout')).toContain(CALQUES_MARKER);
    expect(skillSpecForPrompt('compose-news-section')).not.toContain(CALQUES_MARKER);
  });

  it('the assembled locale-fanout step prompt includes the calque rules', () => {
    const prompt = buildStepPrompt({
      skill: 'locale-fanout',
      date: '2026-07-06',
      outputNote: 'the ja locale sibling of news_section.json.',
    });
    expect(prompt).toContain(CALQUES_MARKER);
    expect(prompt).toContain('--- CALQUE RULES (locale-fanout-calques)');
  });
});
