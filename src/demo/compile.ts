import { fieldById, type CatalogField } from './catalog';
import { clampMonths } from './state';
import type { Agg, CompiledQuery, CompileResult, DemoState, FieldId, QueryPurpose } from './types';

export function measureAlias(id: FieldId, agg: Agg): string {
  return `m_${id}_${agg}`;
}

export function aggExpression(field: CatalogField, agg: Agg): string {
  if (!field.allowedAggs.includes(agg)) throw new Error(`unsupported aggregation: ${agg}`);
  if (field.id === 'learners') return 'COUNT(DISTINCT learner_id)';
  if (field.id === 'fees') return 'COUNT(*)';
  if (agg === 'sum') return `SUM(${field.column})`;
  if (agg === 'avg') return `AVG(${field.column})`;
  if (agg === 'count') return `COUNT(${field.column})`;
  throw new Error(`unsupported aggregation: ${agg}`);
}

function resolve(id: string): CatalogField {
  const field = fieldById(id);
  if (!field) throw new Error(`unknown field: ${id}`);
  return field;
}

function aggFor(state: DemoState, field: CatalogField): Agg {
  const agg = state.measureAgg[field.id] ?? field.defaultAgg;
  if (!agg || !field.allowedAggs.includes(agg)) throw new Error(`unsupported aggregation: ${agg ?? 'none'}`);
  return agg;
}

function whereOf(state: DemoState): { sql: string; params: string[] } {
  const [start, end] = clampMonths(state.monthStart, state.monthEnd);
  const params = [`${start}-01`, `${end}-01`];
  let sql = 'fee_month >= CAST(? AS DATE) AND fee_month <= CAST(? AS DATE)';
  if (state.sites.length > 0) {
    sql += ` AND site IN (${state.sites.map(() => '?').join(', ')})`;
    params.push(...state.sites);
  }
  return { sql, params };
}

function measureSelect(state: DemoState, id: FieldId): string {
  const field = resolve(id);
  const agg = aggFor(state, field);
  return `${aggExpression(field, agg)} AS ${measureAlias(id, agg)}`;
}

function statement(state: DemoState, purpose: QueryPurpose, ordered: FieldId[]): CompiledQuery {
  const filter = whereOf(state);
  const fields = ordered.map((id) => resolve(id));
  const select = fields
    .map((field) => (field.kind === 'measure' ? measureSelect(state, field.id) : (field.column as string)))
    .join(', ');
  const group = fields.filter((field) => field.kind !== 'measure').map((field) => field.column as string);
  const groupSql = group.length > 0 ? ` GROUP BY ${group.join(', ')}` : '';
  return {
    purpose,
    sql: `WITH filtered AS (SELECT * FROM fee_lines WHERE ${filter.sql}) SELECT ${select} FROM filtered${groupSql}`,
    params: filter.params,
  };
}

function chartQuery(state: DemoState): CompiledQuery {
  const filter = whereOf(state);
  const x = resolve(state.chartX as string);
  const series = state.chartSeries ? resolve(state.chartSeries) : null;
  const measures = state.chartY.map((id) => measureSelect(state, id)).join(', ');
  const xCol = x.column as string;
  if (!series) {
    return {
      purpose: 'grid',
      sql: `WITH filtered AS (SELECT * FROM fee_lines WHERE ${filter.sql}) SELECT ${xCol}, ${measures} FROM filtered GROUP BY ${xCol} ORDER BY ${xCol} ASC`,
      params: filter.params,
    };
  }
  const seriesCol = series.column as string;
  const first = resolve(state.chartY[0]);
  const rank = aggExpression(first, aggFor(state, first));
  return {
    purpose: 'grid',
    sql: `WITH filtered AS (SELECT * FROM fee_lines WHERE ${filter.sql}), ranked AS (SELECT ${seriesCol} AS series_key FROM filtered GROUP BY ${seriesCol} ORDER BY ${rank} DESC, ${seriesCol} ASC) SELECT ${xCol}, ${seriesCol}, ${measures} FROM filtered INNER JOIN ranked ON filtered.${seriesCol} = ranked.series_key GROUP BY ${xCol}, ${seriesCol} ORDER BY ${xCol} ASC, ${seriesCol} ASC`,
    params: filter.params,
  };
}

export function compile(state: DemoState): CompileResult {
  if (state.widget === 'chart') {
    if (!state.chartX) return { ok: false, reason: 'need-x' };
    if (state.chartY.length === 0) return { ok: false, reason: 'need-y' };
    state.chartY.forEach((id) => resolve(id));
    if (state.chartSeries) resolve(state.chartSeries);
    resolve(state.chartX);
    return { ok: true, queries: [chartQuery(state)] };
  }
  if (state.widget === 'pivot') {
    if (state.pivotValues.length === 0) return { ok: false, reason: 'need-value' };
    const queries = [statement(state, 'grid', [...state.pivotRows, ...state.pivotColumns, ...state.pivotValues])];
    if (state.pivotColumns.length > 0) {
      queries.push(statement(state, 'column-totals', [...state.pivotColumns, ...state.pivotValues]));
      queries.push(statement(state, 'row-totals', [...state.pivotRows, ...state.pivotValues]));
    }
    queries.push(statement(state, 'grand-total', state.pivotValues));
    return { ok: true, queries };
  }
  if (state.tableColumns.length === 0) return { ok: false, reason: 'need-column' };
  return { ok: true, queries: [statement(state, 'grid', state.tableColumns)] };
}
