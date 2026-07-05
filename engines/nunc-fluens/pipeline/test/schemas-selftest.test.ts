// T3 self-test: every canonical sourcedata file in the committed golden
// fixtures must parse, and toDict(parse(x)) must be a fixpoint
// (parse(toDict) === toDict — the canonical projection is stable).
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CANONICAL_FILES } from '../src/schemas/sourcedata.ts';

const SD = join(import.meta.dirname, '..', 'goldens', 'input', 'sourcedata');

function canonicalIn(dir: string): string[] {
  return Object.keys(CANONICAL_FILES).filter(n => existsSync(join(dir, n)));
}

function checkFile(dir: string, name: string): void {
  const raw = JSON.parse(readFileSync(join(dir, name), 'utf8'));
  const schema = CANONICAL_FILES[name];
  const parsed = schema.parse(raw);
  const dict = schema.toDict(parsed as never);
  const dict2 = schema.toDict(schema.parse(dict) as never);
  expect(dict2, `${dir}/${name} round-trip`).toEqual(dict);
}

describe('sourcedata schemas vs the golden fixture corpus', () => {
  const dates = readdirSync(SD).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();

  it('has the fixture corpus staged', () => {
    expect(dates.length).toBeGreaterThanOrEqual(20); // 10 full days + 16 historical
  });

  it('parses every canonical EN file of every fixture day', () => {
    let count = 0;
    for (const d of dates) {
      const dir = join(SD, d);
      for (const name of canonicalIn(dir)) {
        checkFile(dir, name);
        count++;
      }
    }
    expect(count).toBeGreaterThanOrEqual(60);
  });

  it('parses every canonical locale file of every fixture day', () => {
    const localesRoot = join(SD, 'locales');
    let count = 0;
    for (const d of readdirSync(localesRoot).sort()) {
      const dayRoot = join(localesRoot, d);
      for (const L of readdirSync(dayRoot).sort()) {
        const dir = join(dayRoot, L);
        for (const name of canonicalIn(dir)) {
          checkFile(dir, name);
          count++;
        }
      }
    }
    expect(count).toBeGreaterThanOrEqual(100);
  });
});
