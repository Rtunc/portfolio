import { describe, expect, it } from 'vitest';
import { present } from './shape';
import { preset } from './state';
import type { CompileResult, DemoState, QueryRow } from './types';

const amountGrid: CompileResult = {
  ok: true,
  queries: [{ purpose: 'grid', sql: 'select 1', params: [] }],
};

function presentOk(state: DemoState, results: QueryRow[][], compiled: CompileResult = amountGrid) {
  return present({ state, compiled, results });
}

describe('present', () => {
  it('turns a reason into guidance and zero grid rows into the empty sentence', () => {
    expect(present({ state: preset(), compiled: { ok: false, reason: 'need-x' }, results: null })).toEqual({
      kind: 'guidance',
      message: 'Add a field to X.',
    });
    const table = { ...preset(), widget: 'table' as const, tableColumns: ['site' as const, 'amount' as const] };
    expect(presentOk(table, [[]])).toEqual({ kind: 'empty', message: 'No fees match this filter.' });
  });

  it('leaves a missing pivot combination blank and captions both caps', () => {
    const state: DemoState = {
      ...preset(),
      widget: 'pivot',
      pivotRows: ['site'],
      pivotColumns: ['fee_month'],
      pivotValues: ['amount'],
      chartX: null,
      chartSeries: null,
      chartY: [],
    };
    const grid: QueryRow[] = [
      { site: 'Harbor', fee_month: '2024-01-01', m_amount_sum: 10 },
      { site: 'Mill', fee_month: '2024-02-01', m_amount_sum: 30 },
    ];
    const compiled: CompileResult = {
      ok: true,
      queries: [
        { purpose: 'grid', sql: '', params: [] },
        { purpose: 'column-totals', sql: '', params: [] },
        { purpose: 'row-totals', sql: '', params: [] },
        { purpose: 'grand-total', sql: '', params: [] },
      ],
    };
    const model = present({
      state,
      compiled,
      results: [
        grid,
        [{ fee_month: '2024-01-01', m_amount_sum: 10 }, { fee_month: '2024-02-01', m_amount_sum: 30 }],
        [{ site: 'Harbor', m_amount_sum: 10 }, { site: 'Mill', m_amount_sum: 30 }],
        [{ m_amount_sum: 40 }],
      ],
    });
    expect(model.kind).toBe('pivot');
    if (model.kind !== 'pivot') return;
    expect(model.columnLabels).toEqual(['2024-02', '2024-01']);
    expect(model.body).toEqual([
      [['30'], [null]],
      [[null], ['10']],
    ]);
  });

  it('uses the grand-total average and the grand distinct count, not the visible cells', () => {
    const state: DemoState = {
      ...preset(),
      widget: 'pivot',
      pivotRows: ['site'],
      pivotValues: ['amount', 'learners'],
      measureAgg: { amount: 'avg' },
      chartX: null,
      chartSeries: null,
      chartY: [],
    };
    const compiled: CompileResult = {
      ok: true,
      queries: [
        { purpose: 'grid', sql: '', params: [] },
        { purpose: 'grand-total', sql: '', params: [] },
      ],
    };
    const model = present({
      state,
      compiled,
      results: [
        [
          { site: 'Harbor', m_amount_avg: 10, m_learners_count_distinct: 2 },
          { site: 'Mill', m_amount_avg: 30, m_learners_count_distinct: 2 },
        ],
        [{ m_amount_avg: 100, m_learners_count_distinct: 3 }],
      ],
    });
    expect(model.kind).toBe('pivot');
    if (model.kind !== 'pivot') return;
    expect(model.grand).toEqual(['100', '3']);
    expect(model.totalsNote).toBe('Totals cover every fee in this filter.');
    expect(model.singleCell).toBe(false);
  });

  it('caps a chart at 50 X values and 8 series', () => {
    const rows: QueryRow[] = [];
    for (let x = 0; x < 51; x += 1) {
      for (let series = 0; series < 9; series += 1) {
        rows.push({
          site: `X${String(x).padStart(2, '0')}`,
          fee_month: `S${series}`,
          m_amount_sum: x + series * 100,
        });
      }
    }
    const state = { ...preset(), chartX: 'site' as const, chartSeries: 'fee_month' as const, chartY: ['amount' as const] };
    const model = presentOk(state, [rows]);
    expect(model.kind).toBe('chart');
    if (model.kind !== 'chart') return;
    expect(model.xLabels).toHaveLength(50);
    expect(model.xLabels[0]).toBe('X01');
    expect(model.xLabels[49]).toBe('X50');
    expect(model.series).toHaveLength(8);
    expect(model.series.map((series) => series.name)).toEqual(['S8', 'S7', 'S6', 'S5', 'S4', 'S3', 'S2', 'S1']);
    expect(model.caption).toContain('Showing first 50 values on X.');
    expect(model.caption).toContain('Showing first 8 series.');
  });

  it('renders a measure-only pivot as one grand-total cell', () => {
    const state: DemoState = {
      ...preset(),
      widget: 'pivot',
      pivotValues: ['fees'],
      chartX: null,
      chartSeries: null,
      chartY: [],
    };
    const compiled: CompileResult = { ok: true, queries: [{ purpose: 'grand-total', sql: '', params: [] }] };
    const model = present({ state, compiled, results: [[{ m_fees_count: 4 }]] });
    expect(model).toMatchObject({ kind: 'pivot', singleCell: true, grand: ['4'], body: [] });
  });
});
