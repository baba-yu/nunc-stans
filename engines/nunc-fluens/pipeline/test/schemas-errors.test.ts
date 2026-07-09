// Error-message parity with the Python oracle (sourcedata_schemas.py):
// path-qualified messages, Python type names, repr-quoted values.
import { describe, expect, it } from 'vitest';
import {
  parseBridgesFile, parseChangeLogFile, parseNeedsFile, parsePredictionsFile,
  parseReadingsFile, SourcedataValidationError,
} from '../src/schemas/sourcedata.ts';

function msg(fn: () => unknown): string {
  try { fn(); } catch (e) {
    expect(e).toBeInstanceOf(SourcedataValidationError);
    return (e as Error).message;
  }
  throw new Error('expected a SourcedataValidationError');
}

const pred = {
  id: 'prediction.x', title: 't', body: 'b', summary: 's',
  reasoning: { because: 'b', given: 'g', so_that: 's', landing: 'l', plain_language: 'p' },
};

describe('oracle-parity error messages', () => {
  it('missing required key', () => {
    expect(msg(() => parsePredictionsFile({ predictions: [] })))
      .toBe("predictions.json: missing required key 'date'");
  });

  it('wrong type with python type names', () => {
    expect(msg(() => parsePredictionsFile({ date: 5, predictions: [] })))
      .toBe('predictions.json.date: expected str, got int');
    expect(msg(() => parsePredictionsFile({ date: 'd', predictions: [{ ...pred, reasoning: 'nope' }] })))
      .toBe('predictions.json.predictions[0].reasoning: expected dict, got str');
  });

  it('null where required', () => {
    expect(msg(() => parsePredictionsFile({ date: null, predictions: [] })))
      .toBe('predictions.json.date: must not be null');
  });

  it('nested path through by_prediction map', () => {
    expect(msg(() => parseNeedsFile({ date: 'd', by_prediction: { 'prediction.a': 'x' } })))
      .toBe("needs.json.by_prediction['prediction.a']: expected list, got str");
  });

  it('enum violations render as python tuples with reprs', () => {
    expect(msg(() => parseChangeLogFile({
      date: 'd', vs_date: 'v', items: [{ kind: 'renamed', headline: 'h', diff_narrative: 'n' }],
    }))).toBe(
      "change_log.json.items[0].kind: must be one of ('new', 'updated', 'continuing'), got 'renamed'");
    expect(msg(() => parseBridgesFile({
      date: 'd',
      validation_rows: [{
        prediction_ref: { id: 'i', short_label: 's', prediction_date: 'p' },
        today_relevance: 1, evidence_summary: 'e', reference_links: [],
        bridge: { support_dimension: 'sideways', narrative: 'n', coherence: 3, remaining_gap: 'g' },
      }],
    }))).toBe(
      "bridges.json.validation_rows[0].bridge.support_dimension: must be one of "
      + "('because', 'given', 'so_that', 'landing', 'none'), got 'sideways'");
  });

  it('range checks', () => {
    expect(msg(() => parseReadingsFile({
      date: 'd', relations: [], cluster_pointers: [],
      chain_edges: [{
        source_prediction_id: 'a', downstream_prediction_id: 'b',
        via_evidence_id: null, strength: 1.5, notes: null,
      }],
    }))).toBe('readings.json.chain_edges[0].strength: must be in [0, 1], got 1.5');
  });

  it('non-object where object expected', () => {
    expect(msg(() => parsePredictionsFile({ date: 'd', predictions: [42] })))
      .toBe('predictions.json.predictions[0]: expected object, got int');
  });
});
