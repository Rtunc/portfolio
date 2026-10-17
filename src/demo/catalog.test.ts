import { describe, expect, it } from 'vitest';
import { FIELDS, fieldById, isFieldId, MONTH_MAX, MONTH_MIN, SITES } from './catalog';
import { guidance } from './types';

describe('catalog', () => {
  it('lists time, then dimensions, then measures, with the spec labels', () => {
    expect(FIELDS.map((field) => [field.kind, field.label])).toEqual([
      ['time', 'Month'],
      ['dimension', 'Site'],
      ['dimension', 'Room'],
      ['dimension', 'Programme'],
      ['dimension', 'Fee type'],
      ['dimension', 'Status'],
      ['dimension', 'Learner'],
      ['measure', 'Amount'],
      ['measure', 'Learners'],
      ['measure', 'Fees'],
    ]);
  });

  it('locks aggregation rules', () => {
    expect(fieldById('amount')?.allowedAggs).toEqual(['sum', 'avg', 'count']);
    expect(fieldById('amount')?.defaultAgg).toBe('sum');
    expect(fieldById('learners')?.allowedAggs).toEqual(['count_distinct']);
    expect(fieldById('fees')?.allowedAggs).toEqual(['count']);
    expect(fieldById('learner_id')).toBeUndefined();
    expect(isFieldId('site')).toBe(true);
    expect(isFieldId('learner_id')).toBe(false);
  });

  it('locks the site list and the month window', () => {
    expect(SITES).toEqual(['Harbor', 'Mill', 'Orchard', 'Ridge', 'Station', 'Wharf']);
    expect(MONTH_MIN).toBe('2024-01');
    expect(MONTH_MAX).toBe('2025-06');
  });

  it('maps reasons to the guidance sentences', () => {
    expect(guidance('need-x')).toBe('Add a field to X.');
    expect(guidance('need-y')).toBe('Add a field to Y.');
    expect(guidance('need-value')).toBe('Add a field to Values.');
    expect(guidance('need-column')).toBe('Add a field to Columns.');
  });
});
