import { MONTH_MAX, MONTH_MIN, fieldById } from './catalog';
import type { DemoFilter, FieldKind, FilterOperator } from './types';

const MONTH_RE = /^\d{4}-\d{2}$/;

const LABELS: Record<FilterOperator, string> = {
  equals: 'Equals',
  notEquals: 'Not equals',
  in: 'Is any of',
  notIn: 'Is none of',
  set: 'Is set',
  notSet: 'Is not set',
  gt: 'Greater than',
  gte: 'Greater than or equal',
  lt: 'Less than',
  lte: 'Less than or equal',
  contains: 'Contains',
  notContains: 'Does not contain',
  startsWith: 'Starts with',
  endsWith: 'Ends with',
  inDateRange: 'Between',
  notInDateRange: 'Not between',
  beforeDate: 'Before',
  afterDate: 'After',
};

const BY_KIND: Record<FieldKind, FilterOperator[]> = {
  dimension: ['equals', 'notEquals', 'in', 'notIn', 'contains', 'notContains', 'startsWith', 'endsWith', 'set', 'notSet'],
  measure: ['equals', 'notEquals', 'gt', 'gte', 'lt', 'lte', 'in', 'notIn', 'set', 'notSet'],
  time: ['inDateRange', 'notInDateRange', 'beforeDate', 'afterDate', 'equals', 'set', 'notSet'],
};

export function operatorsForKind(kind: FieldKind): FilterOperator[] {
  return BY_KIND[kind];
}

export function operatorLabel(operator: FilterOperator): string {
  return LABELS[operator];
}

export function valueSlots(operator: FilterOperator): 0 | 1 | 2 {
  if (operator === 'set' || operator === 'notSet') return 0;
  if (operator === 'inDateRange' || operator === 'notInDateRange') return 2;
  return 1;
}

export function clampMonths(start: string, end: string): [string, string] {
  const ok = (value: string) => MONTH_RE.test(value) && value >= MONTH_MIN && value <= MONTH_MAX;
  if (!ok(start) || !ok(end)) return [MONTH_MIN, MONTH_MAX];
  return start <= end ? [start, end] : [end, start];
}

function quotedList(values: string[]): { sql: string; params: string[] } | null {
  const params = values.map((value) => value.trim()).filter((value) => value.length > 0);
  if (params.length === 0) return null;
  return { sql: params.map(() => '?').join(', '), params };
}

function splitList(value: string | undefined): string[] {
  return (value ?? '').split(',').map((item) => item.trim()).filter((item) => item.length > 0);
}

function numberValue(value: string | undefined): string | null {
  const text = value?.trim() ?? '';
  if (!/^-?\d+(\.\d+)?$/.test(text)) return null;
  return text;
}

function monthValue(value: string | undefined): string | null {
  const text = value?.trim() ?? '';
  if (!MONTH_RE.test(text)) return null;
  return `${text}-01`;
}

function clause(filter: DemoFilter): { sql: string; params: string[] } | null {
  if (!filter.field) return null;
  const field = fieldById(filter.field);
  if (!field) return null;
  const column = field.column;
  const { operator } = filter;
  if (operator === 'set') {
    if (!column) return null;
    return field.kind === 'dimension'
      ? { sql: `(${column} IS NOT NULL AND ${column} <> '')`, params: [] }
      : { sql: `${column} IS NOT NULL`, params: [] };
  }
  if (operator === 'notSet') {
    if (!column) return null;
    return field.kind === 'dimension'
      ? { sql: `(${column} IS NULL OR ${column} = '')`, params: [] }
      : { sql: `${column} IS NULL`, params: [] };
  }
  if (field.kind === 'time') {
    if (!column) return null;
    if (operator === 'inDateRange' || operator === 'notInDateRange') {
      const start = filter.values[0]?.trim() ?? '';
      const end = filter.values[1]?.trim() ?? '';
      if (!start || !end) return null;
      const [from, to] = clampMonths(start, end);
      const sql = `${column} >= CAST(? AS DATE) AND ${column} <= CAST(? AS DATE)`;
      const params = [`${from}-01`, `${to}-01`];
      return operator === 'inDateRange' ? { sql, params } : { sql: `NOT (${sql})`, params };
    }
    const bound = monthValue(filter.values[0]);
    if (!bound) return null;
    if (operator === 'beforeDate') return { sql: `${column} < CAST(? AS DATE)`, params: [bound] };
    if (operator === 'afterDate') return { sql: `${column} > CAST(? AS DATE)`, params: [bound] };
    if (operator === 'equals') return { sql: `${column} = CAST(? AS DATE)`, params: [bound] };
    return null;
  }
  if (!column) return null;
  if (field.kind === 'measure') {
    if (operator === 'in' || operator === 'notIn') {
      const list = quotedList(splitList(filter.values[0]).filter((item) => numberValue(item)));
      if (!list) return null;
      const marks = list.params.map(() => 'CAST(? AS DOUBLE)').join(', ');
      const sql = operator === 'in' ? `${column} IN (${marks})` : `${column} NOT IN (${marks})`;
      return { sql, params: list.params };
    }
    const value = numberValue(filter.values[0]);
    if (!value) return null;
    const compare: Partial<Record<FilterOperator, string>> = {
      equals: '=',
      notEquals: '<>',
      gt: '>',
      gte: '>=',
      lt: '<',
      lte: '<=',
    };
    const sign = compare[operator];
    if (!sign) return null;
    return { sql: `${column} ${sign} CAST(? AS DOUBLE)`, params: [value] };
  }
  if (operator === 'in' || operator === 'notIn') {
    const list = quotedList(splitList(filter.values[0]));
    if (!list) return null;
    const sql = operator === 'in' ? `${column} IN (${list.sql})` : `${column} NOT IN (${list.sql})`;
    return { sql, params: list.params };
  }
  const value = filter.values[0]?.trim() ?? '';
  if (!value) return null;
  if (operator === 'equals') return { sql: `${column} = ?`, params: [value] };
  if (operator === 'notEquals') return { sql: `${column} <> ?`, params: [value] };
  if (operator === 'contains') return { sql: `contains(${column}, ?)`, params: [value] };
  if (operator === 'notContains') return { sql: `NOT contains(${column}, ?)`, params: [value] };
  if (operator === 'startsWith') return { sql: `starts_with(${column}, ?)`, params: [value] };
  if (operator === 'endsWith') return { sql: `ends_with(${column}, ?)`, params: [value] };
  return null;
}

export function whereOfFilters(filters: readonly DemoFilter[]): { sql: string; params: string[] } {
  const parts: string[] = [];
  const params: string[] = [];
  for (const filter of filters) {
    const piece = clause(filter);
    if (!piece) continue;
    parts.push(piece.sql);
    params.push(...piece.params);
  }
  if (parts.length === 0) return { sql: 'TRUE', params: [] };
  return { sql: parts.join(' AND '), params };
}
