import { fieldById } from './catalog';
import { measureAlias } from './compile';
import { formatMeasure } from './format';
import { guidance } from './types';
import type { Agg, DemoState, FieldId, QueryPurpose, QueryRow, VisualModel } from './types';

const TOTALS_NOTE = 'Totals cover every fee in this filter.';
const EMPTY: VisualModel = { kind: 'empty', message: 'No fees match this filter.' };

type Input = {
  state: DemoState;
  compiled: { ok: true; queries: { purpose: QueryPurpose }[] } | { ok: false; reason: 'need-x' | 'need-y' | 'need-value' | 'need-column' };
  results: QueryRow[][] | null;
};

function fieldColumn(id: FieldId): string {
  const field = fieldById(id);
  if (!field) throw new Error(`unknown field: ${id}`);
  return field.column ?? id;
}

function aggOf(state: DemoState, id: FieldId): Agg {
  const field = fieldById(id);
  if (!field?.defaultAgg) throw new Error(`unknown field: ${id}`);
  const agg = state.measureAgg[id] ?? field.defaultAgg;
  if (!field.allowedAggs.includes(agg)) throw new Error(`unsupported aggregation: ${agg}`);
  return agg;
}

function labelOf(id: FieldId, value: string | number | null): string {
  if (value == null) return '';
  const text = String(value);
  if (id === 'fee_month' && /^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 7);
  return text;
}

function keyOf(ids: FieldId[], row: QueryRow): string {
  return ids.map((id) => labelOf(id, row[fieldColumn(id)])).join(' · ');
}

function readMeasure(row: QueryRow | undefined, key: string): number | null {
  if (!row) return null;
  const value = row[key];
  if (value == null) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCell(state: DemoState, id: FieldId, row: QueryRow | undefined): string | null {
  const agg = aggOf(state, id);
  const raw = readMeasure(row, measureAlias(id, agg));
  if (raw == null) return null;
  return formatMeasure(raw, agg);
}

function rankLabels(scores: Map<string, number>, cap: number): { labels: string[]; capped: boolean } {
  const labels = [...scores.keys()].sort((left, right) => {
    const diff = (scores.get(right) ?? 0) - (scores.get(left) ?? 0);
    if (diff !== 0) return diff;
    return left.localeCompare(right);
  });
  return { labels: labels.slice(0, cap), capped: labels.length > cap };
}

function scoresFor(rows: QueryRow[], keyFields: FieldId[], measure: (row: QueryRow) => number, sumDuplicates: boolean): Map<string, number> {
  const scores = new Map<string, number>();
  for (const row of rows) {
    const key = keyOf(keyFields, row);
    const value = measure(row);
    scores.set(key, sumDuplicates ? (scores.get(key) ?? 0) + value : value);
  }
  return scores;
}

export function present({ state, compiled, results }: Input): VisualModel {
  if (!compiled.ok) return { kind: 'guidance', message: guidance(compiled.reason) };
  const packs = results ?? [];
  const rowsFor = (purpose: QueryPurpose): QueryRow[] | null => {
    const index = compiled.queries.findIndex((query) => query.purpose === purpose);
    if (index < 0) return null;
    return packs[index] ?? [];
  };
  if (state.widget === 'table') return presentTable(state, rowsFor('grid') ?? []);
  if (state.widget === 'pivot') return presentPivot(state, rowsFor);
  return presentChart(state, rowsFor('grid') ?? []);
}

function presentTable(state: DemoState, grid: QueryRow[]): VisualModel {
  if (state.tableColumns.length === 0) return { kind: 'guidance', message: guidance('need-column') };
  if (grid.length === 0) return EMPTY;
  const measures = state.tableColumns.filter((id) => fieldById(id)?.kind === 'measure');
  const dimensions = state.tableColumns.filter((id) => fieldById(id)?.kind !== 'measure');
  const firstMeasure = measures[0];
  const firstDimension = dimensions[0];
  const ranked = [...grid].sort((left, right) => {
    if (firstMeasure) {
      const alias = measureAlias(firstMeasure, aggOf(state, firstMeasure));
      const diff = (readMeasure(right, alias) ?? 0) - (readMeasure(left, alias) ?? 0);
      if (diff !== 0) return diff;
    }
    if (firstDimension) {
      return labelOf(firstDimension, left[fieldColumn(firstDimension)]).localeCompare(
        labelOf(firstDimension, right[fieldColumn(firstDimension)]),
      );
    }
    return 0;
  });
  const kept = ranked.slice(0, 200);
  return {
    kind: 'table',
    headers: state.tableColumns.map((id) => fieldById(id)?.label ?? id),
    rows: kept.map((row) =>
      state.tableColumns.map((id) => {
        if (fieldById(id)?.kind === 'measure') return formatCell(state, id, row);
        const text = labelOf(id, row[fieldColumn(id)]);
        return text.length === 0 ? null : text;
      }),
    ),
    caption: ranked.length > 200 ? 'Showing first 200 rows.' : null,
  };
}

function presentPivot(
  state: DemoState,
  rowsFor: (purpose: QueryPurpose) => QueryRow[] | null,
): VisualModel {
  if (state.pivotValues.length === 0) return { kind: 'guidance', message: guidance('need-value') };
  const measures = state.pivotValues;
  const rowFields = state.pivotRows;
  const columnFields = state.pivotColumns;
  const first = measures[0];
  const firstAlias = measureAlias(first, aggOf(state, first));
  const measureOf = (row: QueryRow) => readMeasure(row, firstAlias) ?? 0;
  const grandRows = rowsFor('grand-total');
  const grid = rowsFor('grid');

  if (rowFields.length === 0 && columnFields.length === 0) {
    const source = (grandRows ?? grid ?? [])[0];
    if (!source || readMeasure(source, firstAlias) == null) return EMPTY;
    return {
      kind: 'pivot',
      rowLabels: [],
      columnLabels: [],
      measureLabels: measures.map((id) => fieldById(id)?.label ?? id),
      body: [],
      rowTotals: null,
      columnTotals: null,
      grand: measures.map((id) => formatCell(state, id, source)),
      caption: null,
      totalsNote: TOTALS_NOTE,
      singleCell: true,
    };
  }

  if (!grid || grid.length === 0) return EMPTY;

  const rowTotals = rowsFor('row-totals');
  const columnTotals = rowsFor('column-totals');
  const rowScores = scoresFor(rowTotals ?? grid, rowFields, measureOf, rowTotals == null);
  const columnScores = scoresFor(columnTotals ?? grid, columnFields, measureOf, columnTotals == null);
  const rankedRows = rankLabels(rowScores, 50);
  const rankedColumns = rankLabels(columnScores, 12);
  const rowLabels = rowFields.length === 0 ? [''] : rankedRows.labels;
  const columnLabels = columnFields.length === 0 ? [] : rankedColumns.labels;
  const bodyColumns = columnLabels.length === 0 ? [''] : columnLabels;
  const rowCapped = rowFields.length > 0 && rankedRows.capped;
  const columnCapped = columnFields.length > 0 && rankedColumns.capped;
  const cells = new Map<string, QueryRow>();
  for (const row of grid) cells.set(`${keyOf(rowFields, row)}\0${keyOf(columnFields, row)}`, row);
  const aligned = (source: QueryRow[] | null, fields: FieldId[], labels: string[]) => {
    if (!source) return null;
    const byKey = new Map(source.map((row) => [keyOf(fields, row), row]));
    return labels.map((label) => measures.map((id) => formatCell(state, id, byKey.get(label))));
  };
  const bothAxes = rowFields.length > 0 && columnFields.length > 0;
  let caption: string | null = null;
  if (rowCapped && columnCapped) caption = 'Showing first 50 rows and first 12 columns.';
  else if (rowCapped) caption = 'Showing first 50 rows.';
  else if (columnCapped) caption = 'Showing first 12 columns.';

  return {
    kind: 'pivot',
    rowLabels: rowFields.length === 0 ? [] : rowLabels,
    columnLabels,
    measureLabels: measures.map((id) => fieldById(id)?.label ?? id),
    body: rowLabels.map((rowLabel) =>
      bodyColumns.map((columnLabel) => measures.map((id) => formatCell(state, id, cells.get(`${rowLabel}\0${columnLabel}`)))),
    ),
    rowTotals: bothAxes ? aligned(rowTotals, rowFields, rowLabels) : null,
    columnTotals: bothAxes ? aligned(columnTotals, columnFields, columnLabels) : null,
    grand: grandRows && grandRows.length > 0 ? measures.map((id) => formatCell(state, id, grandRows[0])) : null,
    caption,
    totalsNote: TOTALS_NOTE,
    singleCell: false,
  };
}

function presentChart(state: DemoState, grid: QueryRow[]): VisualModel {
  if (!state.chartX) return { kind: 'guidance', message: guidance('need-x') };
  if (state.chartY.length === 0) return { kind: 'guidance', message: guidance('need-y') };
  if (grid.length === 0) return EMPTY;
  const xField = state.chartX;
  const seriesField = state.chartSeries;
  const first = state.chartY[0];
  const firstAlias = measureAlias(first, aggOf(state, first));
  const xScores = new Map<string, number>();
  const seriesScores = new Map<string, number>();
  const values = new Map<string, number | null>();
  for (const row of grid) {
    const xLabel = labelOf(xField, row[fieldColumn(xField)]);
    const seriesLabel = seriesField ? labelOf(seriesField, row[fieldColumn(seriesField)]) : '';
    const amount = readMeasure(row, firstAlias);
    xScores.set(xLabel, (xScores.get(xLabel) ?? 0) + (amount ?? 0));
    if (seriesField) {
      seriesScores.set(seriesLabel, (seriesScores.get(seriesLabel) ?? 0) + (amount ?? 0));
      values.set(`${xLabel}\0${seriesLabel}`, amount);
    } else {
      for (const id of state.chartY) {
        values.set(`${xLabel}\0${id}`, readMeasure(row, measureAlias(id, aggOf(state, id))));
      }
    }
  }
  const rankedX = rankLabels(xScores, 50);
  const xLabels = [...rankedX.labels].sort((left, right) => left.localeCompare(right));
  const parts: string[] = [];
  if (rankedX.capped) parts.push('Showing first 50 values on X.');
  let series: { name: string; values: (number | null)[] }[];
  if (seriesField) {
    const rankedSeries = rankLabels(seriesScores, 8);
    if (rankedSeries.capped) parts.push('Showing first 8 series.');
    series = rankedSeries.labels.map((name) => ({
      name,
      values: xLabels.map((xLabel) => values.get(`${xLabel}\0${name}`) ?? null),
    }));
  } else {
    const measures = state.chartY.slice(0, 8);
    if (state.chartY.length > 8) parts.push('Showing first 8 series.');
    series = measures.map((id) => ({
      name: fieldById(id)?.label ?? id,
      values: xLabels.map((xLabel) => values.get(`${xLabel}\0${id}`) ?? null),
    }));
  }
  return {
    kind: 'chart',
    mark: state.chartMark,
    xLabels,
    series,
    caption: parts.length === 0 ? null : parts.join(' '),
  };
}
