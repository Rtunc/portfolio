import { describe, expect, it } from 'vitest';
import {
  addField,
  addFilter,
  dropOnWell,
  preset,
  removeField,
  removeFilter,
  setAgg,
  setFilterField,
  setFilterOperator,
  switchWidget,
} from './state';
import type { DemoState } from './types';

function chartState(): DemoState {
  return {
    ...preset(),
    chartX: 'fee_month',
    chartSeries: 'site',
    chartY: ['amount'],
    extras: ['room'],
  };
}

describe('preset', () => {
  it('opens on fees by month split by site', () => {
    expect(preset()).toMatchObject({
      widget: 'chart',
      chartMark: 'column',
      chartX: 'fee_month',
      chartSeries: 'site',
      chartY: ['amount'],
      extras: [],
      measureAgg: { amount: 'sum' },
      filters: [{ field: 'fee_month', operator: 'inDateRange', values: ['2024-01', '2025-06'] }],
    });
  });
});

describe('filters', () => {
  it('resets the operator when the new field kind cannot keep it', () => {
    expect(setFilterField(preset(), 0, 'site').filters[0]).toEqual({ field: 'site', operator: 'equals', values: [] });
    const kept = setFilterField(
      { ...preset(), filters: [{ field: 'site', operator: 'contains', values: ['Harbor'] }] },
      0,
      'room',
    );
    expect(kept.filters[0]).toEqual({ field: 'room', operator: 'contains', values: ['Harbor'] });
  });

  it('clears values when the operator needs a different number of slots', () => {
    expect(setFilterOperator(preset(), 0, 'beforeDate').filters[0]).toEqual({
      field: 'fee_month',
      operator: 'beforeDate',
      values: [],
    });
    expect(setFilterOperator(preset(), 0, 'contains').filters[0].operator).toBe('inDateRange');
  });

  it('appends a blank row and drops one by index', () => {
    const added = addFilter(preset());
    expect(added.filters[1]).toEqual({ field: null, operator: 'equals', values: [] });
    expect(removeFilter(added, 0).filters).toEqual([added.filters[1]]);
  });
});

describe('placement', () => {
  it('refuses a measure dropped on a dimension well', () => {
    const before = switchWidget(preset(), 'pivot');
    expect(dropOnWell(before, 'amount', 'pivotRows')).toEqual(before);
  });

  it('parks the previous X field when another dimension is dropped on X', () => {
    const next = dropOnWell(chartState(), 'room', 'chartX');
    expect(next.chartX).toBe('room');
    expect(next.extras).toEqual(['fee_month']);
    expect(next.chartSeries).toBe('site');
  });

  it('click-adds a third chart dimension to extras', () => {
    const next = addField(chartState(), 'programme');
    expect(next.chartX).toBe('fee_month');
    expect(next.chartSeries).toBe('site');
    expect(next.extras).toEqual(['room', 'programme']);
  });

  it('ignores aggregation changes for learners', () => {
    const next = setAgg(preset(), 'learners', 'sum');
    expect(next.measureAgg.learners).toBeUndefined();
    expect(setAgg(preset(), 'amount', 'avg').measureAgg.amount).toBe('avg');
  });
});

describe('switchWidget', () => {
  it('moves a chart onto table columns and pivot wells', () => {
    const table = switchWidget(chartState(), 'table');
    expect(table.tableColumns).toEqual(['fee_month', 'site', 'room', 'amount']);
    expect(table.extras).toEqual([]);
    const pivot = switchWidget(chartState(), 'pivot');
    expect(pivot.pivotRows).toEqual(['fee_month', 'room']);
    expect(pivot.pivotColumns).toEqual(['site']);
    expect(pivot.pivotValues).toEqual(['amount']);
  });

  it('moves a table onto a chart and onto a pivot', () => {
    const table = {
      ...preset(),
      widget: 'table' as const,
      tableColumns: ['fee_month', 'site', 'room', 'amount'] as DemoState['tableColumns'],
      chartX: null,
      chartSeries: null,
      chartY: [],
    };
    expect(switchWidget(table, 'chart')).toMatchObject({
      chartX: 'fee_month',
      chartSeries: 'site',
      extras: ['room'],
      chartY: ['amount'],
    });
    expect(switchWidget(table, 'pivot')).toMatchObject({
      pivotRows: ['fee_month', 'site'],
      pivotColumns: ['room'],
      pivotValues: ['amount'],
    });
    const oneDim = { ...table, tableColumns: ['site', 'amount'] as DemoState['tableColumns'] };
    expect(switchWidget(oneDim, 'pivot')).toMatchObject({
      pivotRows: ['site'],
      pivotColumns: [],
      pivotValues: ['amount'],
    });
  });

  it('moves a pivot onto a chart and onto a table', () => {
    const pivot = {
      ...preset(),
      widget: 'pivot' as const,
      pivotRows: ['fee_month', 'room'] as DemoState['pivotRows'],
      pivotColumns: ['site', 'programme'] as DemoState['pivotColumns'],
      pivotValues: ['amount', 'fees'] as DemoState['pivotValues'],
      chartX: null,
      chartSeries: null,
      chartY: [],
    };
    expect(switchWidget(pivot, 'chart')).toMatchObject({
      chartX: 'fee_month',
      chartSeries: 'site',
      extras: ['room', 'programme'],
      chartY: ['amount', 'fees'],
    });
    expect(switchWidget(pivot, 'table').tableColumns).toEqual([
      'fee_month',
      'room',
      'site',
      'programme',
      'amount',
      'fees',
    ]);
  });

  it('removes a field from every well', () => {
    const next = removeField(chartState(), 'site');
    expect(next.chartSeries).toBeNull();
    expect(next.chartX).toBe('fee_month');
    expect(next.extras).toEqual(['room']);
  });
});
