import type { Agg, FieldId, FieldKind } from './types';

export type CatalogField = {
  id: FieldId;
  label: string;
  kind: FieldKind;
  column: string | null;
  defaultAgg: Agg | null;
  allowedAggs: Agg[];
};

export const SITES = ['Harbor', 'Mill', 'Orchard', 'Ridge', 'Station', 'Wharf'] as const;
export const MONTH_MIN = '2024-01';
export const MONTH_MAX = '2025-06';

export const FIELDS: readonly CatalogField[] = [
  { id: 'fee_month', label: 'Month', kind: 'time', column: 'fee_month', defaultAgg: null, allowedAggs: [] },
  { id: 'site', label: 'Site', kind: 'dimension', column: 'site', defaultAgg: null, allowedAggs: [] },
  { id: 'room', label: 'Room', kind: 'dimension', column: 'room', defaultAgg: null, allowedAggs: [] },
  { id: 'programme', label: 'Programme', kind: 'dimension', column: 'programme', defaultAgg: null, allowedAggs: [] },
  { id: 'fee_type', label: 'Fee type', kind: 'dimension', column: 'fee_type', defaultAgg: null, allowedAggs: [] },
  { id: 'status', label: 'Status', kind: 'dimension', column: 'status', defaultAgg: null, allowedAggs: [] },
  { id: 'learner', label: 'Learner', kind: 'dimension', column: 'learner', defaultAgg: null, allowedAggs: [] },
  { id: 'amount', label: 'Amount', kind: 'measure', column: 'amount', defaultAgg: 'sum', allowedAggs: ['sum', 'avg', 'count'] },
  { id: 'learners', label: 'Learners', kind: 'measure', column: null, defaultAgg: 'count_distinct', allowedAggs: ['count_distinct'] },
  { id: 'fees', label: 'Fees', kind: 'measure', column: null, defaultAgg: 'count', allowedAggs: ['count'] },
];

export function fieldById(id: string): CatalogField | undefined {
  return FIELDS.find((field) => field.id === id);
}

export function isFieldId(id: string): id is FieldId {
  return fieldById(id) !== undefined;
}
