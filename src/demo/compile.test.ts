import { describe, expect, it } from 'vitest';
import { compile } from './compile';
import { preset } from './state';
import type { DemoState } from './types';

function compileOk(state: DemoState) {
  const result = compile(state);
  if (!result.ok) throw new Error(result.reason);
  return result.queries;
}

describe('compile preset', () => {
  const [query] = compileOk(preset());

  it('groups month and site, sums amount, and binds the window once', () => {
    expect(query.sql).toContain('SUM(amount) AS m_amount_sum');
    expect(query.sql).toContain('fee_month');
    expect(query.sql).toContain('site');
    expect(query.sql).not.toContain('LIMIT');
    expect(query.sql).not.toContain('site IN');
    expect(query.params).toEqual(['2024-01-01', '2025-06-01']);
  });
});

describe('compile filters', () => {
  it('adds a site predicate only when the row is complete', () => {
    const open = compileOk({ ...preset(), widget: 'table', tableColumns: ['site', 'amount'], chartX: null, chartSeries: null, chartY: [] });
    expect(open[0].sql).not.toContain('site IN');
    const closed = compileOk({
      ...preset(),
      widget: 'table',
      tableColumns: ['amount'],
      chartX: null,
      chartSeries: null,
      chartY: [],
      filters: [...preset().filters, { field: 'site', operator: 'in', values: ["O'Wharf"] }],
    });
    expect(closed[0].sql).toContain('site IN (?)');
    expect(closed[0].sql).not.toContain("O'Wharf");
    expect(closed[0].params).toEqual(['2024-01-01', '2025-06-01', "O'Wharf"]);
    const partial = compileOk({
      ...preset(),
      filters: [...preset().filters, { field: 'site', operator: 'contains', values: [''] }],
    });
    expect(partial[0].sql).not.toContain('contains(site');
    const harbor = compileOk({
      ...preset(),
      filters: [...preset().filters, { field: 'site', operator: 'contains', values: ['Harbor'] }],
    });
    expect(harbor[0].sql).toContain('contains(site, ?)');
    expect(harbor[0].sql).not.toContain('Harbor');
    expect(harbor[0].params).toContain('Harbor');
  });

  it('swaps a reversed pair, keeps 2024-13, and replaces an illegal month with the full window', () => {
    const swapped = compileOk({
      ...preset(),
      filters: [{ field: 'fee_month', operator: 'inDateRange', values: ['2025-06', '2024-02'] }],
    });
    expect(swapped[0].params).toEqual(['2024-02-01', '2025-06-01']);
    const odd = compileOk({
      ...preset(),
      filters: [{ field: 'fee_month', operator: 'inDateRange', values: ['2024-13', '2025-06'] }],
    });
    expect(odd[0].params).toEqual(['2024-13-01', '2025-06-01']);
    const illegal = compileOk({
      ...preset(),
      filters: [{ field: 'fee_month', operator: 'inDateRange', values: ['2020-01', '2024-02'] }],
    });
    expect(illegal[0].params).toEqual(['2024-01-01', '2025-06-01']);
    const junk = compileOk({
      ...preset(),
      filters: [{ field: 'fee_month', operator: 'inDateRange', values: ['March', '2024-02'] }],
    });
    expect(junk[0].params).toEqual(['2024-01-01', '2025-06-01']);
  });

  it('queries every row when the list is empty and skips a value-less or column-less row', () => {
    const all = compileOk({ ...preset(), filters: [] });
    expect(all[0].sql).toContain('WHERE TRUE');
    expect(all[0].params).toEqual([]);
    const half = compileOk({
      ...preset(),
      filters: [{ field: 'fee_month', operator: 'inDateRange', values: ['2024-03', ''] }],
    });
    expect(half[0].sql).toContain('WHERE TRUE');
    expect(half[0].params).toEqual([]);
    const present = compileOk({
      ...preset(),
      filters: [{ field: 'site', operator: 'set', values: [] }],
    });
    expect(present[0].sql).toContain("(site IS NOT NULL AND site <> '')");
    expect(present[0].params).toEqual([]);
    const learners = compileOk({
      ...preset(),
      filters: [...preset().filters, { field: 'learners', operator: 'gt', values: ['3'] }],
    });
    expect(learners[0].params).toEqual(['2024-01-01', '2025-06-01']);
    expect(learners[0].sql).not.toContain('CAST(? AS DOUBLE)');
    const amount = compileOk({
      ...preset(),
      filters: [...preset().filters, { field: 'amount', operator: 'gt', values: ['10'] }],
    });
    expect(amount[0].sql).toContain('amount > CAST(? AS DOUBLE)');
    expect(amount[0].params).toContain('10');
    expect(amount[0].sql).not.toContain("'10'");
  });
});

describe('compile measures and reasons', () => {
  it('compiles learners as count distinct and rejects an unknown field', () => {
    const queries = compileOk({
      ...preset(),
      widget: 'table',
      tableColumns: ['learners'],
      chartX: null,
      chartSeries: null,
      chartY: [],
    });
    expect(queries[0].sql).toContain('COUNT(DISTINCT learner_id) AS m_learners_count_distinct');
    expect(() => compileOk({ ...preset(), chartY: ['nope' as 'amount'] })).toThrow('unknown field: nope');
    expect(() =>
      compile({ ...preset(), measureAgg: { amount: 'count_distinct' } }),
    ).toThrow('unsupported aggregation: count_distinct');
  });

  it('returns reason codes and still compiles a measure-only pivot', () => {
    expect(compile({ ...preset(), chartX: null, chartSeries: null, chartY: [] })).toEqual({ ok: false, reason: 'need-x' });
    expect(compile({ ...preset(), chartY: [] })).toEqual({ ok: false, reason: 'need-y' });
    expect(compile({ ...preset(), widget: 'pivot', pivotValues: [], chartX: null, chartSeries: null, chartY: [] })).toEqual({
      ok: false,
      reason: 'need-value',
    });
    expect(compile({ ...preset(), widget: 'table', tableColumns: [], chartX: null, chartSeries: null, chartY: [] })).toEqual({
      ok: false,
      reason: 'need-column',
    });
    const pivot = compileOk({
      ...preset(),
      widget: 'pivot',
      pivotValues: ['amount'],
      chartX: null,
      chartSeries: null,
      chartY: [],
    });
    expect(pivot.map((query) => query.purpose)).toEqual(['grid', 'grand-total']);
    expect(pivot[0].sql).not.toContain('GROUP BY');
  });

  it('ranks chart series by the first measure and ignores extras', () => {
    const [query] = compileOk({
      ...preset(),
      chartY: ['learners', 'amount'],
      extras: ['room'],
    });
    expect(query.sql).toContain('ORDER BY COUNT(DISTINCT learner_id) DESC, site ASC');
    expect(query.sql).not.toContain('room');
  });

  it('emits pivot total statements only when a column field exists', () => {
    const both = compileOk({
      ...preset(),
      widget: 'pivot',
      pivotRows: ['fee_month'],
      pivotColumns: ['site'],
      pivotValues: ['amount'],
      chartX: null,
      chartSeries: null,
      chartY: [],
    });
    expect(both.map((query) => query.purpose)).toEqual(['grid', 'column-totals', 'row-totals', 'grand-total']);
    const rowsOnly = compileOk({
      ...preset(),
      widget: 'pivot',
      pivotRows: ['fee_month'],
      pivotValues: ['amount'],
      chartX: null,
      chartSeries: null,
      chartY: [],
    });
    expect(rowsOnly.map((query) => query.purpose)).toEqual(['grid', 'grand-total']);
  });
});
