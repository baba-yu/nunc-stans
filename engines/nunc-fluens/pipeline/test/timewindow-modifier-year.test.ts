import { describe, expect, it } from 'vitest';
import { parseTimeWindow } from '../src/ingest/timewindow.ts';

// Live-run find (2026-07-07, instance `news`): "By mid-2027, Figure ships
// humanoids at fleet volume" left target dates NULL and failed puv-news.
describe('modifier-on-bare-year time windows', () => {
  it('parses mid-YYYY as the middle third of the year', () => {
    expect(parseTimeWindow('By mid-2027, Figure ships humanoids at fleet volume, not demo units.'))
      .toEqual(['2027-05-01', '2027-08-31']);
  });

  it('parses early/late variants', () => {
    expect(parseTimeWindow('early 2028')).toEqual(['2028-01-01', '2028-04-30']);
    expect(parseTimeWindow('late-2026')).toEqual(['2026-09-01', '2026-12-31']);
  });

  it('does not shadow modifier-on-month expressions', () => {
    expect(parseTimeWindow('mid-June 2027')).toEqual(['2027-06-11', '2027-06-20']);
  });
});
