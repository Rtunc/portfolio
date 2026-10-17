import { describe, expect, it } from 'vitest';
import { formatMeasure } from './format';

describe('formatMeasure', () => {
  it('groups integers and drops the decimal part', () => {
    expect(formatMeasure(1000, 'sum')).toBe('1,000');
    expect(formatMeasure(1000, 'count')).toBe('1,000');
    expect(formatMeasure(1000, 'count_distinct')).toBe('1,000');
  });

  it('keeps up to two decimal places for an average and trims trailing zeros', () => {
    expect(formatMeasure(1000.5, 'avg')).toBe('1,000.5');
    expect(formatMeasure(1000, 'avg')).toBe('1,000');
    expect(formatMeasure(1.256, 'avg')).toBe('1.26');
  });
});
