// T4c gate: the TS export layer reproduces the oracle's graph /
// glossary / manifest JSONs. Comparison is on PARSED values (JSON
// numbers are typeless: python emits `1.0`, JS `1` — semantically
// identical to every consumer), after the volatile-field normalization.
import { describe, expect, it } from 'vitest';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { runExport } from '../src/export/export.ts';
import {
  buildGoldenDb, GOLDENS, goldenCaptureCollision, normalizeVolatile,
} from './helpers/build-db.ts';

const EXPECTED = join(GOLDENS, 'expected', 'export');
const FILES = ['graph-tech.json', 'graph-business.json', 'graph-mix.json',
  'glossary.json', 'manifest.json'];

/** Ring-layout coordinates come from sin/cos, which differ between
 * python's libm and V8 in the last ULP. They only seed the frontend
 * force layout, so round layout.x/.y to 9 decimals before comparing.
 * Everything else stays exact. */
function roundLayouts(v: unknown): void {
  if (Array.isArray(v)) { for (const x of v) roundLayouts(x); return; }
  if (typeof v !== 'object' || v === null) return;
  const o = v as Record<string, unknown>;
  const layout = o.layout as Record<string, unknown> | undefined;
  if (layout && typeof layout === 'object') {
    for (const k of ['x', 'y']) {
      const n = layout[k];
      if (typeof n === 'number') layout[k] = Number(n.toFixed(9));
    }
  }
  for (const k of Object.keys(o)) if (k !== 'layout') roundLayouts(o[k]);
}

describe('export parity vs the oracle golden JSONs', () => {
  it.skipIf(goldenCaptureCollision())(
    'reproduces all five export files (parsed-equal, normalized)',
    { timeout: 180_000 }, () => {
      const { db, workRoot } = buildGoldenDb();
      try {
        const outDir = join(workRoot, 'docs', 'data');
        runExport(db, { outputDir: outDir, publishRoot: workRoot });
        for (const f of FILES) {
          const got = JSON.parse(normalizeVolatile(readFileSync(join(outDir, f), 'utf8')));
          const golden = JSON.parse(normalizeVolatile(readFileSync(join(EXPECTED, f), 'utf8')));
          roundLayouts(got);
          roundLayouts(golden);
          expect(got, f).toEqual(golden);
        }
      } finally {
        db.close();
        rmSync(workRoot, { recursive: true, force: true });
      }
    });
});
