// Topics: the single source of truth for what the pipeline searches for
// (topics-authoring plan W1/W2/W8). `data/reference/news-topics.json` holds
// user-authored topics with intent weights; the coverage gate, the compose
// fan-out, and the (future) authoring extractor all read it through here.
// The pre-plan `news-topics.md` converts lazily on first read (bullets →
// broad topics) — user data is never migrated by hand.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REFERENCE_REL } from './world-paths.ts';

export type TopicIntent = 'deep' | 'broad' | 'watch';
export const TOPIC_INTENTS: TopicIntent[] = ['deep', 'broad', 'watch'];

export interface Topic {
  name: string;
  intent: TopicIntent;
  mandatory: boolean; // must be enumerated every run (orthogonal to intent)
  note?: string; // the user's natural-language trace; the gate shows it as a tag
}

export interface TopicsFile {
  topics: Topic[];
  // The md's "Default reference sites" section survives the migration here —
  // compose inlines them as prompt context, same as before.
  reference_sites?: string[];
}

export function topicsJsonPath(newsRepo: string): string {
  return join(newsRepo, ...REFERENCE_REL.split('/'), 'news-topics.json');
}

export function topicsMdPath(newsRepo: string): string {
  return join(newsRepo, ...REFERENCE_REL.split('/'), 'news-topics.md');
}

/** Strict parse: refuse rather than half-load an editorial-policy file. */
export function parseTopicsFile(raw: string): TopicsFile {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('news-topics.json: not valid JSON');
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data))
    throw new Error('news-topics.json: expected an object {topics, reference_sites?}');
  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.topics) || obj.topics.length === 0)
    throw new Error('news-topics.json: topics must be a non-empty array');
  const seen = new Set<string>();
  const topics: Topic[] = obj.topics.map((t, i) => {
    if (typeof t !== 'object' || t === null) throw new Error(`news-topics.json: topics[${i}] is not an object`);
    const o = t as Record<string, unknown>;
    if (typeof o.name !== 'string' || !o.name.trim())
      throw new Error(`news-topics.json: topics[${i}].name must be a non-empty string`);
    if (!TOPIC_INTENTS.includes(o.intent as TopicIntent))
      throw new Error(`news-topics.json: topics[${i}].intent must be one of ${TOPIC_INTENTS.join('|')}`);
    if (typeof o.mandatory !== 'boolean')
      throw new Error(`news-topics.json: topics[${i}].mandatory must be a boolean`);
    if (o.note !== undefined && typeof o.note !== 'string')
      throw new Error(`news-topics.json: topics[${i}].note must be a string`);
    const name = o.name.trim();
    if (seen.has(name)) throw new Error(`news-topics.json: duplicate topic name ${JSON.stringify(name)}`);
    seen.add(name);
    const topic: Topic = { name, intent: o.intent as TopicIntent, mandatory: o.mandatory };
    if (typeof o.note === 'string' && o.note) topic.note = o.note;
    return topic;
  });
  const sites = Array.isArray(obj.reference_sites)
    ? obj.reference_sites.filter((s): s is string => typeof s === 'string' && !!s.trim())
    : undefined;
  return sites && sites.length ? { topics, reference_sites: sites } : { topics };
}

/**
 * One-time `.md` → `.json` conversion (plan migration note). Names are kept
 * VERBATIM — the coverage gate, verification.json entries, and the goldens
 * all match topic strings exactly. `mandatory` derives from the human's own
 * annotation in the name ("every run"); everything else lands `broad`.
 */
export function convertTopicsMd(md: string): TopicsFile {
  const listSection = /## Topic list\n([\s\S]*?)(?:\n## |$)/.exec(md)?.[1] ?? '';
  const topics: Topic[] = listSection
    .split('\n')
    .filter((l) => l.startsWith('- ') && !/For each of the above/i.test(l))
    .map((l) => l.slice(2).trim())
    .filter(Boolean)
    .map((name) => ({ name, intent: 'broad' as TopicIntent, mandatory: /every run/i.test(name) }));
  if (!topics.length) throw new Error('news-topics.md: no bullets under "## Topic list" to convert');
  const sitesSection = /## Default reference sites\n([\s\S]*?)(?:\n## |$)/.exec(md)?.[1] ?? '';
  const reference_sites = sitesSection
    .split('\n')
    .filter((l) => l.startsWith('- '))
    .map((l) => l.slice(2).trim())
    .filter(Boolean);
  return reference_sites.length ? { topics, reference_sites } : { topics };
}

export function serializeTopicsFile(tf: TopicsFile): string {
  return JSON.stringify(tf, null, 2) + '\n';
}

/**
 * Load an instance's topics: `.json` is the authority; a `.md` with no
 * `.json` beside it converts on first read and writes the `.json` back
 * (best-effort — a read-only view source still loads, it just converts
 * again next time). Neither file ⇒ an instructive refusal.
 */
export function loadTopics(newsRepo: string): TopicsFile {
  const jsonPath = topicsJsonPath(newsRepo);
  if (existsSync(jsonPath)) return parseTopicsFile(readFileSync(jsonPath, 'utf8'));
  const mdPath = topicsMdPath(newsRepo);
  if (existsSync(mdPath)) {
    const tf = convertTopicsMd(readFileSync(mdPath, 'utf8'));
    try {
      writeFileSync(jsonPath, serializeTopicsFile(tf));
      console.error(`topics: converted ${mdPath} -> news-topics.json (one-time migration)`);
    } catch {
      console.error(`topics: read-only source — converted ${mdPath} in memory only`);
    }
    return tf;
  }
  throw new Error(
    `no news-topics.json (or legacy news-topics.md) under ${newsRepo}/${REFERENCE_REL} — `
      + 'author topics in the Formans world view, or seed the file from the instance template',
  );
}

export const topicNames = (tf: TopicsFile): string[] => tf.topics.map((t) => t.name);

/**
 * The compose prompt block — shaped like the old news-topics.md so the
 * writer prompt stays stable across the migration.
 */
export function topicsPromptBlock(tf: TopicsFile): string {
  const lines = ['## Topic list', '', ...tf.topics.map((t) => `- ${t.name}`)];
  if (tf.reference_sites?.length) {
    lines.push('', '## Default reference sites', '', ...tf.reference_sites.map((s) => `- ${s}`));
  }
  return lines.join('\n') + '\n';
}
