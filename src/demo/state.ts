import { fieldById, MONTH_MAX, MONTH_MIN, SITES } from './catalog';
import type { Agg, DemoState, FieldId, WellId, WidgetType } from './types';

const MONTH_RE = /^\d{4}-\d{2}$/;

export function clampMonths(start: string, end: string): [string, string] {
  const ok = (value: string) => MONTH_RE.test(value) && value >= MONTH_MIN && value <= MONTH_MAX;
  if (!ok(start) || !ok(end)) return [MONTH_MIN, MONTH_MAX];
  return start <= end ? [start, end] : [end, start];
}

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
    sites: [],
    monthStart: MONTH_MIN,
    monthEnd: MONTH_MAX,
  };
}

export function normalizeFilters(state: DemoState): DemoState {
  const [monthStart, monthEnd] = clampMonths(state.monthStart, state.monthEnd);
  const allowed = new Set<string>(SITES);
  return { ...state, monthStart, monthEnd, sites: state.sites.filter((site) => allowed.has(site)) };
}

export function setSites(state: DemoState, sites: string[]): DemoState {
  return normalizeFilters({ ...state, sites });
}

export function setMonths(state: DemoState, start: string, end: string): DemoState {
  return normalizeFilters({ ...state, monthStart: start, monthEnd: end });
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
  const next = blank(normalizeFilters(state), widget);
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
