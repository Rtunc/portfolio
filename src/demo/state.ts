import { fieldById } from './catalog';
import { operatorsForKind, valueSlots } from './filters';
import type { Agg, DemoFilter, DemoState, FieldId, FilterOperator, WellId, WidgetType } from './types';

export function preset(): DemoState {
  return {
    widget: 'chart',
    chartMark: 'column',
    tableColumns: [],
    pivotRows: [],
    pivotColumns: [],
    pivotValues: [],
    chartX: 'fee_month',
    chartSeries: 'site',
    chartY: ['amount'],
    extras: [],
    measureAgg: { amount: 'sum' },
    filters: [{ field: 'fee_month', operator: 'inDateRange', values: ['2024-01', '2025-06'] }],
  };
}

function replaceFilter(state: DemoState, index: number, filter: DemoFilter): DemoState {
  if (index < 0 || index >= state.filters.length) return state;
  const filters = state.filters.slice();
  filters[index] = filter;
  return { ...state, filters };
}

export function addFilter(state: DemoState): DemoState {
  return { ...state, filters: [...state.filters, { field: null, operator: 'equals', values: [] }] };
}

export function removeFilter(state: DemoState, index: number): DemoState {
  return { ...state, filters: state.filters.filter((_, item) => item !== index) };
}

export function setFilterField(state: DemoState, index: number, field: FieldId | null): DemoState {
  const current = state.filters[index];
  if (!current) return state;
  if (!field) return replaceFilter(state, index, { field: null, operator: 'equals', values: [] });
  const kind = fieldById(field)?.kind;
  if (!kind) return state;
  const legal = operatorsForKind(kind);
  if (legal.includes(current.operator)) return replaceFilter(state, index, { ...current, field });
  return replaceFilter(state, index, { field, operator: legal[0], values: [] });
}

export function setFilterOperator(state: DemoState, index: number, operator: FilterOperator): DemoState {
  const current = state.filters[index];
  if (!current?.field) return state;
  const kind = fieldById(current.field)?.kind;
  if (!kind || !operatorsForKind(kind).includes(operator)) return state;
  const values = valueSlots(current.operator) === valueSlots(operator) ? current.values : [];
  return replaceFilter(state, index, { ...current, operator, values });
}

export function setFilterValue(state: DemoState, index: number, slot: number, value: string): DemoState {
  const current = state.filters[index];
  if (!current || slot < 0) return state;
  const values = current.values.slice();
  values[slot] = value;
  return replaceFilter(state, index, { ...current, values });
}

function isMeasure(id: FieldId): boolean {
  return fieldById(id)?.kind === 'measure';
}

function strip(state: DemoState, id: FieldId): DemoState {
  const drop = (ids: FieldId[]) => ids.filter((item) => item !== id);
  return {
    ...state,
    tableColumns: drop(state.tableColumns),
    pivotRows: drop(state.pivotRows),
    pivotColumns: drop(state.pivotColumns),
    pivotValues: drop(state.pivotValues),
    chartY: drop(state.chartY),
    extras: drop(state.extras),
    chartX: state.chartX === id ? null : state.chartX,
    chartSeries: state.chartSeries === id ? null : state.chartSeries,
  };
}

function accepts(well: WellId, id: FieldId): boolean {
  const measure = isMeasure(id);
  if (well === 'tableColumns') return true;
  if (well === 'chartY' || well === 'pivotValues') return measure;
  return !measure;
}

function place(state: DemoState, id: FieldId, well: WellId): DemoState {
  if (well === 'chartX' || well === 'chartSeries') {
    const previous = state[well];
    const next = { ...state, [well]: id };
    if (previous && previous !== id) next.extras = [...next.extras, previous];
    return next;
  }
  if (well === 'tableColumns') return { ...state, tableColumns: [...state.tableColumns, id] };
  if (well === 'pivotRows') return { ...state, pivotRows: [...state.pivotRows, id] };
  if (well === 'pivotColumns') return { ...state, pivotColumns: [...state.pivotColumns, id] };
  if (well === 'pivotValues') return { ...state, pivotValues: [...state.pivotValues, id] };
  return { ...state, chartY: [...state.chartY, id] };
}

export function dropOnWell(state: DemoState, id: FieldId, well: WellId): DemoState {
  if (!accepts(well, id)) return state;
  return place(strip(state, id), id, well);
}

export function addField(state: DemoState, id: FieldId): DemoState {
  const cleared = strip(state, id);
  if (isMeasure(id)) {
    if (cleared.widget === 'table') return place(cleared, id, 'tableColumns');
    if (cleared.widget === 'pivot') return place(cleared, id, 'pivotValues');
    return place(cleared, id, 'chartY');
  }
  if (cleared.widget === 'table') return place(cleared, id, 'tableColumns');
  if (cleared.widget === 'pivot') return place(cleared, id, 'pivotRows');
  if (!cleared.chartX) return place(cleared, id, 'chartX');
  if (!cleared.chartSeries) return place(cleared, id, 'chartSeries');
  return { ...cleared, extras: [...cleared.extras, id] };
}

export function removeField(state: DemoState, id: FieldId): DemoState {
  return strip(state, id);
}

export function setAgg(state: DemoState, id: FieldId, agg: Agg): DemoState {
  if (id !== 'amount' || (agg !== 'sum' && agg !== 'avg' && agg !== 'count')) return state;
  return { ...state, measureAgg: { ...state.measureAgg, amount: agg } };
}

function blank(state: DemoState, widget: WidgetType): DemoState {
  return {
    ...state,
    widget,
    tableColumns: [],
    pivotRows: [],
    pivotColumns: [],
    pivotValues: [],
    chartX: null,
    chartSeries: null,
    chartY: [],
    extras: [],
  };
}

export function switchWidget(state: DemoState, widget: WidgetType): DemoState {
  if (state.widget === widget) return state;
  const next = blank(state, widget);
  if (state.widget === 'chart') {
    const dimensions = [state.chartX, ...state.extras].filter((id): id is FieldId => id !== null);
    if (widget === 'table') {
      const series = state.chartSeries ? [state.chartSeries] : [];
      return { ...next, tableColumns: [state.chartX, ...series, ...state.extras].filter((id): id is FieldId => id !== null).concat(state.chartY) };
    }
    return {
      ...next,
      pivotRows: dimensions,
      pivotColumns: state.chartSeries ? [state.chartSeries] : [],
      pivotValues: state.chartY,
    };
  }
  if (state.widget === 'table') {
    const dimensions = state.tableColumns.filter((id) => !isMeasure(id));
    const measures = state.tableColumns.filter((id) => isMeasure(id));
    if (widget === 'chart') {
      return { ...next, chartX: dimensions[0] ?? null, chartSeries: dimensions[1] ?? null, extras: dimensions.slice(2), chartY: measures };
    }
    if (dimensions.length >= 2) {
      return { ...next, pivotRows: dimensions.slice(0, -1), pivotColumns: [dimensions[dimensions.length - 1]], pivotValues: measures };
    }
    return { ...next, pivotRows: dimensions, pivotValues: measures };
  }
  const measures = state.pivotValues.filter((id) => isMeasure(id));
  if (widget === 'table') {
    return { ...next, tableColumns: [...state.pivotRows, ...state.pivotColumns, ...state.extras, ...measures] };
  }
  const remaining = [...state.pivotRows.slice(1), ...state.pivotColumns.slice(1), ...state.extras];
  return {
    ...next,
    chartX: state.pivotRows[0] ?? null,
    chartSeries: state.pivotColumns[0] ?? null,
    extras: remaining,
    chartY: measures,
  };
}
