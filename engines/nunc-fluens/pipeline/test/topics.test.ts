import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  convertTopicsMd, loadTopics, parseTopicsFile, serializeTopicsFile,
  topicsJsonPath, topicsMdPath, topicsPromptBlock,
} from '../src/topics.ts';

const VALID = {
  topics: [
    { name: 'Alpha', intent: 'broad', mandatory: false },
    { name: 'Beta (every run)', intent: 'deep', mandatory: true },
    { name: 'Gamma', intent: 'watch', mandatory: false, note: 'news-driven' },
  ],
  reference_sites: ['https://example.com/'],
};

function scratchRepo(): string {
  const repo = mkdtempSync(join(tmpdir(), 'nf-topics-'));
  mkdirSync(join(repo, 'data', 'reference'), { recursive: true });
  return repo;
}

describe('parseTopicsFile', () => {
  it('round-trips a valid file', () => {
    const tf = parseTopicsFile(JSON.stringify(VALID));
    expect(tf.topics).toHaveLength(3);
    expect(tf.topics[1]).toEqual({ name: 'Beta (every run)', intent: 'deep', mandatory: true });
    expect(tf.topics[2].note).toBe('news-driven');
    expect(tf.reference_sites).toEqual(['https://example.com/']);
  });

  it('refuses malformed authorities rather than half-loading them', () => {
    for (const bad of [
      'not json',
      '{"topics": []}',
      JSON.stringify({ topics: [{ name: '', intent: 'broad', mandatory: false }] }),
      JSON.stringify({ topics: [{ name: 'A', intent: 'loud', mandatory: false }] }),
      JSON.stringify({ topics: [{ name: 'A', intent: 'broad' }] }),
      JSON.stringify({ topics: [
        { name: 'A', intent: 'broad', mandatory: false },
        { name: 'A', intent: 'watch', mandatory: false }] }),
    ]) {
      expect(() => parseTopicsFile(bad), bad.slice(0, 40)).toThrow();
    }
  });
});

describe('convertTopicsMd (one-time migration)', () => {
  it('converts bullets verbatim, derives mandatory from the human annotation, keeps sites', () => {
    const md = '# Daily-update topic coverage\n\n## Topic list\n\n'
      + '- LLM Workflow\n'
      + '- Local LLM Optimization, Fine-tuning (Unsloth — every run)\n'
      + '\n## Default reference sites\n\n- https://example.com/\n';
    const tf = convertTopicsMd(md);
    expect(tf.topics.map((t) => t.name)).toEqual([
      'LLM Workflow',
      'Local LLM Optimization, Fine-tuning (Unsloth — every run)', // verbatim — the gate matches exactly
    ]);
    expect(tf.topics[0]).toMatchObject({ intent: 'broad', mandatory: false });
    expect(tf.topics[1].mandatory).toBe(true);
    expect(tf.reference_sites).toEqual(['https://example.com/']);
  });

  it('refuses an md with no topic bullets', () => {
    expect(() => convertTopicsMd('# nothing here\n')).toThrow(/no bullets/);
  });
});

describe('loadTopics', () => {
  it('prefers the json authority', () => {
    const repo = scratchRepo();
    writeFileSync(topicsJsonPath(repo), serializeTopicsFile(parseTopicsFile(JSON.stringify(VALID))));
    writeFileSync(topicsMdPath(repo), '## Topic list\n\n- Should Not Win\n');
    expect(loadTopics(repo).topics.map((t) => t.name)).toContain('Alpha');
  });

  it('converts a lone legacy md on first read and writes the json back', () => {
    const repo = scratchRepo();
    writeFileSync(topicsMdPath(repo), '## Topic list\n\n- Legacy Topic\n');
    const tf = loadTopics(repo);
    expect(tf.topics[0].name).toBe('Legacy Topic');
    expect(existsSync(topicsJsonPath(repo))).toBe(true); // write-back happened
    const reread = JSON.parse(readFileSync(topicsJsonPath(repo), 'utf8'));
    expect(reread.topics[0].name).toBe('Legacy Topic');
  });

  it('refuses instructively when neither file exists', () => {
    expect(() => loadTopics(scratchRepo())).toThrow(/news-topics\.json/);
  });
});

describe('topicsPromptBlock', () => {
  it('keeps the md-era shape the writer prompt expects', () => {
    const block = topicsPromptBlock(parseTopicsFile(JSON.stringify(VALID)));
    expect(block).toContain('## Topic list');
    expect(block).toContain('- Alpha');
    expect(block).toContain('## Default reference sites');
    expect(block).toContain('- https://example.com/');
  });
});
