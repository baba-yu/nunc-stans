import { describe, expect, it } from 'vitest';
import { structuralErrors } from '../src/render/post-write-integrity.ts';

const block = (newsLink: string, fpLink: string) => `# heading

## 2026-07-07

### News

- **Something** — happened.

${newsLink}

### Predictions check

- **A prediction** (relevance 5) — evidence.

${fpLink}

---
`;

// Live run 2026-07-07 (instance `news`): the model wrote human link labels
// for the correct targets; the contract is the target, not the anchor text.
describe('README terminating-link check is target-anchored', () => {
  it('accepts filename anchor text (news-era convention)', () => {
    expect(structuralErrors('readme', block(
      'Full report: [news-20260707.md](data/daily-news/en/news-20260707.md)',
      'Full: [future-prediction-20260707.md](data/future-prediction/en/future-prediction-20260707.md)',
    ))).toEqual([]);
  });

  it('accepts human label anchor text for the correct target', () => {
    expect(structuralErrors('readme', block(
      'Full report: [News report — 2026-07-07](data/daily-news/en/news-20260707.md)',
      'Full report: [Prediction validation — 2026-07-07](data/future-prediction/en/future-prediction-20260707.md)',
    ))).toEqual([]);
  });

  it('still fails when the target is wrong or missing', () => {
    const errs = structuralErrors('readme', block(
      'Full report: [News report](data/daily-news/en/)', // no file target
      'no link at all',
    ));
    expect(errs.length).toBe(2);
  });
});
