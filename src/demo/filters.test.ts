import { describe, expect, it } from 'vitest';
import { operatorLabel, operatorsForKind } from './filters';

describe('operatorsForKind', () => {
  it('lists dimension, measure, and time operators in product order', () => {
    expect(operatorsForKind('dimension')).toEqual([
      'equals',
      'notEquals',
      'in',
      'notIn',
      'contains',
      'notContains',
      'startsWith',
      'endsWith',
      'set',
      'notSet',
    ]);
    expect(operatorsForKind('measure')).toEqual([
      'equals',
      'notEquals',
      'gt',
      'gte',
      'lt',
      'lte',
      'in',
      'notIn',
      'set',
      'notSet',
    ]);
    expect(operatorsForKind('time')).toEqual([
      'inDateRange',
      'notInDateRange',
      'beforeDate',
      'afterDate',
      'equals',
      'set',
      'notSet',
    ]);
    expect(operatorsForKind('time')).not.toContain('contains');
    expect(operatorsForKind('measure')).not.toContain('contains');
    expect(operatorsForKind('dimension')).not.toContain('gt');
    expect(operatorsForKind('time')).not.toContain('gt');
  });

  it('uses the short English labels', () => {
    expect(operatorLabel('gt')).toBe('Greater than');
    expect(operatorLabel('inDateRange')).toBe('Between');
    expect(operatorLabel('notInDateRange')).toBe('Not between');
    expect(operatorLabel('beforeDate')).toBe('Before');
    expect(operatorLabel('afterDate')).toBe('After');
  });
});
