import { describe, expect, it } from 'vitest';
import { scanText } from '../src/render/lint-markdown-clean.ts';

describe('lint forbidden tokens', () => {
  it('flags storyline day numbering', () => {
    expect(scanText('carrying the day-3 storyline forward').length).toBe(1);
    expect(scanText('day-12 of the arc').length).toBe(1);
    expect(scanText('day-twenty-one recap').length).toBe(1);
  });

  it('does not flag day-0 industry vocabulary (cold-start 2026-07-07 false positive)', () => {
    expect(scanText('SGLang ships day-0 support for new open weights')).toEqual([]);
    expect(scanText('SGLang は day-0 対応で追随')).toEqual([]);
    expect(scanText('soporte day-0 para los pesos abiertos')).toEqual([]);
  });

  it('still flags scope prefixes and parser anchors', () => {
    expect(scanText('(Tech) something').length).toBe(1);
    expect(scanText('**Summary:** anchored').length).toBe(1);
  });
});
