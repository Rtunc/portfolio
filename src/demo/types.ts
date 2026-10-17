export type WidgetType = 'table' | 'pivot' | 'chart';
export type ChartMark = 'column' | 'line';
export type Agg = 'sum' | 'avg' | 'count' | 'count_distinct';
export type FieldKind = 'dimension' | 'time' | 'measure';
export type Reason = 'need-x' | 'need-y' | 'need-value' | 'need-column';
export type FieldId =
  | 'site'
  | 'room'
  | 'programme'
  | 'fee_type'
  | 'status'
  | 'learner'
  | 'fee_month'
  | 'amount'
  | 'learners'
  | 'fees';
export type WellId =
  | 'tableColumns'
  | 'pivotRows'
  | 'pivotColumns'
  | 'pivotValues'
  | 'chartX'
  | 'chartSeries'
  | 'chartY';

export type DemoState = {
  widget: WidgetType;
  chartMark: ChartMark;
  tableColumns: FieldId[];
  pivotRows: FieldId[];
  pivotColumns: FieldId[];
  pivotValues: FieldId[];
  chartX: FieldId | null;
  chartSeries: FieldId | null;
  chartY: FieldId[];
  extras: FieldId[];
  measureAgg: Partial<Record<FieldId, Agg>>;
  sites: string[];
  monthStart: string;
  monthEnd: string;
};

export type QueryPurpose = 'grid' | 'column-totals' | 'row-totals' | 'grand-total';

export type CompiledQuery = {
  purpose: QueryPurpose;
  sql: string;
  params: string[];
};

export type CompileResult =
  | { ok: false; reason: Reason }
  | { ok: true; queries: CompiledQuery[] };

export type QueryRow = Record<string, string | number | null>;

export type TableModel = {
  kind: 'table';
  headers: string[];
  rows: (string | null)[][];
  caption: string | null;
};

export type PivotModel = {
  kind: 'pivot';
  rowLabels: string[];
  columnLabels: string[];
  measureLabels: string[];
  body: (string | null)[][][];
  rowTotals: (string | null)[][] | null;
  columnTotals: (string | null)[][] | null;
  grand: (string | null)[] | null;
  caption: string | null;
  totalsNote: string;
  singleCell: boolean;
};

export type ChartModel = {
  kind: 'chart';
  mark: ChartMark;
  xLabels: string[];
  series: { name: string; values: (number | null)[] }[];
  caption: string | null;
};

export type VisualModel =
  | { kind: 'guidance'; message: string }
  | { kind: 'empty'; message: 'No fees match this filter.' }
  | TableModel
  | PivotModel
  | ChartModel;

export function guidance(reason: Reason): string {
  if (reason === 'need-x') return 'Add a field to X.';
  if (reason === 'need-y') return 'Add a field to Y.';
  if (reason === 'need-value') return 'Add a field to Values.';
  return 'Add a field to Columns.';
}
