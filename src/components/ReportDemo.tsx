import { useEffect, useLayoutEffect, useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import {
  boxFrame,
  canvasHeight,
  cellDelta,
  clampMove,
  clampResize,
  createWidget,
  duplicateBelow,
  insertBeside,
  planAutoRow,
  presetWidget,
  topLayer,
  type CanvasWidget,
  type WidgetFamily,
} from '../demo/canvas';
import { FIELDS, MONTH_MAX, MONTH_MIN, fieldById, isFieldId } from '../demo/catalog';
import { compile } from '../demo/compile';
import { openBrowserExecutor } from '../demo/browser-db';
import { LoadError, PREVIEW_COLUMNS, createQueue, loadFeeLines, previewSql, type SqlExecutor } from '../demo/engine';
import { operatorLabel, operatorsForKind, valueSlots } from '../demo/filters';
import { present } from '../demo/shape';
import { addField, addFilter, dropOnWell, preset, removeField, removeFilter, setAgg, setFilterField, setFilterOperator, setFilterValue, switchWidget } from '../demo/state';
import type { ChartMark, DemoState, FieldId, FieldKind, QueryRow, VisualModel, WellId } from '../demo/types';
import { guidance } from '../demo/types';
import { LineagePath } from './LineagePath';
import { ReportVisual } from './ReportVisual';

type Queue = ReturnType<typeof createQueue>;

function FieldTypeMark({ kind }: { kind: FieldKind }) {
  if (kind === 'time') {
    return (
      <svg className="crv2-type" data-type="time" viewBox="0 0 14 14" aria-hidden="true">
        <rect x="1.5" y="2.5" width="11" height="10" rx="1.5" fill="none" stroke="#C19C00" strokeWidth="1.2" />
        <path d="M1.5 5.5h11M4.5 1.5v2M9.5 1.5v2" fill="none" stroke="#C19C00" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'measure') {
    return (
      <svg className="crv2-type" data-type="measure" viewBox="0 0 14 14" aria-hidden="true">
        <path d="M3.5 2.5v9M10.5 2.5v9M2 5h10M2 9h10" fill="none" stroke="#118DFF" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg className="crv2-type" data-type="dimension" viewBox="0 0 14 14" aria-hidden="true">
      <text x="7" y="11" textAnchor="middle" fill="#6d6d6d" fontSize="11" fontFamily="system-ui, sans-serif" fontWeight="650">
        T
      </text>
    </svg>
  );
}

function EyeGlyph() {
  return (
    <svg className="crv2-type" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M1.5 8s2.5-4 6.5-4 6.5 4 6.5 4-2.5 4-6.5 4-6.5-4-6.5-4z" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="8" cy="8" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function TableGlyph() {
  return (
    <svg className="crv2-type" data-type="table" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="1.5" y="2" width="13" height="12" rx="1.5" fill="none" stroke="#6d6d6d" strokeWidth="1.2" />
      <path d="M1.5 6h13M1.5 10h13M6.5 6v8" fill="none" stroke="#6d6d6d" strokeWidth="1.2" />
    </svg>
  );
}

const AGG_OPTIONS = [
  ['sum', 'Sum'],
  ['avg', 'Average'],
  ['count', 'Count'],
] as const;

const CHART_MARKS = new Set([
  'column',
  'column-stacked',
  'column-stacked-100',
  'column-line',
  'bar',
  'bar-stacked',
  'bar-stacked-100',
  'line',
  'line-markers',
  'line-stepped',
  'area',
  'area-stacked',
  'area-stacked-100',
  'area-markers',
  'pie',
  'donut',
]);

const VISUALS: { group: string; items: { id: string; label: string; live: boolean }[] }[] = [
  { group: 'Pie', items: [{ id: 'pie', label: 'Pie', live: true }, { id: 'donut', label: 'Donut', live: true }] },
  {
    group: 'Column',
    items: [
      { id: 'column', label: 'Clustered column', live: true },
      { id: 'column-stacked', label: 'Stacked column', live: true },
      { id: 'column-stacked-100', label: '100% stacked column', live: true },
      { id: 'column-line', label: 'Column and line', live: true },
    ],
  },
  {
    group: 'Bar',
    items: [
      { id: 'bar', label: 'Clustered bar', live: true },
      { id: 'bar-stacked', label: 'Stacked bar', live: true },
      { id: 'bar-stacked-100', label: '100% stacked bar', live: true },
    ],
  },
  {
    group: 'Line',
    items: [
      { id: 'line', label: 'Line', live: true },
      { id: 'line-markers', label: 'Line with markers', live: true },
      { id: 'line-stepped', label: 'Stepped line', live: true },
    ],
  },
  {
    group: 'Area',
    items: [
      { id: 'area', label: 'Area', live: true },
      { id: 'area-stacked', label: 'Stacked area', live: true },
      { id: 'area-stacked-100', label: '100% stacked area', live: true },
      { id: 'area-markers', label: 'Area with markers', live: true },
    ],
  },
  {
    group: 'Scatter',
    items: [
      { id: 'scatter', label: 'Scatter', live: false },
      { id: 'bubble', label: 'Bubble', live: false },
      { id: 'bubble-cloud', label: 'Bubble cloud', live: false },
    ],
  },
  {
    group: 'Others',
    items: [
      { id: 'table', label: 'Data Table', live: true },
      { id: 'pivot-table', label: 'Pivot Table', live: true },
      { id: 'number-card', label: 'Number card', live: false },
      { id: 'slicer', label: 'Slicer', live: false },
    ],
  },
];

function wellsOf(state: DemoState): { id: WellId; label: string; fields: FieldId[] }[] {
  if (state.widget === 'table') return [{ id: 'tableColumns', label: 'Columns', fields: state.tableColumns }];
  if (state.widget === 'pivot') {
    return [
      { id: 'pivotRows', label: 'Rows', fields: state.pivotRows },
      { id: 'pivotColumns', label: 'Columns', fields: state.pivotColumns },
      { id: 'pivotValues', label: 'Values', fields: state.pivotValues },
    ];
  }
  return [
    { id: 'chartX', label: 'X-axis', fields: state.chartX ? [state.chartX] : [] },
    { id: 'chartY', label: 'Y-axis', fields: state.chartY },
    { id: 'chartSeries', label: 'Legend', fields: state.chartSeries ? [state.chartSeries] : [] },
  ];
}

function isChartMark(id: string): id is ChartMark {
  return (CHART_MARKS as ReadonlySet<string>).has(id);
}

function shownLabel(id: FieldId, state: DemoState, aliases: Partial<Record<FieldId, string>>): string {
  const alias = aliases[id];
  if (alias) return alias;
  const field = fieldById(id);
  if (!field || field.kind !== 'measure') return field?.label ?? id;
  const agg = id === 'amount' ? state.measureAgg.amount ?? 'sum' : field.defaultAgg;
  const word = agg === 'avg' ? 'Average' : agg === 'count' ? 'Count' : agg === 'count_distinct' ? 'Count distinct' : 'Sum';
  return `${word} of ${field.label}`;
}

function withAliases(model: VisualModel, state: DemoState, aliases: Partial<Record<FieldId, string>>): VisualModel {
  if (model.kind === 'table') {
    return { ...model, headers: state.tableColumns.map((id, index) => aliases[id] ?? model.headers[index] ?? id) };
  }
  if (model.kind === 'pivot') {
    return { ...model, measureLabels: state.pivotValues.map((id, index) => aliases[id] ?? model.measureLabels[index] ?? id) };
  }
  if (model.kind === 'chart' && !state.chartSeries) {
    return {
      ...model,
      series: model.series.map((series, index) => {
        const id = state.chartY[index];
        const alias = id ? aliases[id] : undefined;
        return alias ? { ...series, name: alias } : series;
      }),
    };
  }
  return model;
}

function moveBefore(state: DemoState, well: WellId, id: FieldId, before: FieldId): DemoState {
  if (id === before) return state;
  const list =
    well === 'tableColumns' ? state.tableColumns
    : well === 'pivotRows' ? state.pivotRows
    : well === 'pivotColumns' ? state.pivotColumns
    : well === 'pivotValues' ? state.pivotValues
    : well === 'chartY' ? state.chartY
    : null;
  if (!list || !list.includes(id) || !list.includes(before)) return state;
  const next = list.filter((item) => item !== id);
  next.splice(next.indexOf(before), 0, id);
  if (well === 'tableColumns') return { ...state, tableColumns: next };
  if (well === 'pivotRows') return { ...state, pivotRows: next };
  if (well === 'pivotColumns') return { ...state, pivotColumns: next };
  if (well === 'pivotValues') return { ...state, pivotValues: next };
  return { ...state, chartY: next };
}

function TileGlyph({ id }: { id: string }) {
  if (id === 'table' || id === 'pivot-table') {
    return (
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
        <rect x="4" y="6" width="24" height="4" fill="#118DFF" />
        <rect x="4" y="12" width="24" height="3" fill="#b9d6e6" />
        <rect x="4" y="17" width="24" height="3" fill="#d7e7f0" />
        <rect x="4" y="22" width="24" height="3" fill="#b9d6e6" />
      </svg>
    );
  }
  if (id.startsWith('line') || id.startsWith('area')) {
    return (
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
        <polyline points="4,24 12,14 20,18 28,8" fill="none" stroke="#118DFF" strokeWidth="2" />
      </svg>
    );
  }
  if (id === 'pie' || id === 'donut') {
    return (
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="10" fill="#118DFF" />
        <path d="M16 16 L16 6 A10 10 0 0 1 26 16 Z" fill="#F2C80F" />
      </svg>
    );
  }
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="6" y="14" width="5" height="12" fill="#118DFF" />
      <rect x="13" y="8" width="5" height="18" fill="#F2C80F" />
      <rect x="20" y="18" width="5" height="8" fill="#12239E" />
    </svg>
  );
}

function FilterRows({
  state,
  setState,
}: {
  state: DemoState;
  setState: (update: (current: DemoState) => DemoState) => void;
}) {
  return (
    <div className="crv2-filters">
      <p>Filters</p>
      {state.filters.length === 0 ? (
        <p className="crv2-empty">No filters yet — add one to narrow this widget's data.</p>
      ) : (
        <ul className="crv2-filter-list">
          {state.filters.map((filter, index) => {
            const field = filter.field ? fieldById(filter.field) : undefined;
            const n = index + 1;
            const slots = field ? valueSlots(filter.operator) : 0;
            return (
              <li key={index} className="crv2-filter-row">
                {field ? <FieldTypeMark kind={field.kind} /> : <span className="crv2-type" />}
                <select
                  className="crv2-filter-field"
                  aria-label={`Field ${n}`}
                  value={filter.field ?? ''}
                  onChange={(event) => {
                    const picked = event.target.value;
                    setState((current) => setFilterField(current, index, isFieldId(picked) ? picked : null));
                  }}
                >
                  <option value="">Select a field</option>
                  {FIELDS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <button type="button" aria-label={`Remove filter ${n}`} onClick={() => setState((current) => removeFilter(current, index))}>
                  ×
                </button>
                <select
                  className="crv2-filter-op"
                  aria-label={`Operator ${n}`}
                  value={field ? filter.operator : ''}
                  disabled={!field}
                  onChange={(event) => {
                    const picked = event.target.value;
                    setState((current) => {
                      const row = current.filters[index];
                      const kind = row?.field ? fieldById(row.field)?.kind : undefined;
                      if (!kind) return current;
                      const operator = operatorsForKind(kind).find((item) => item === picked);
                      return operator ? setFilterOperator(current, index, operator) : current;
                    });
                  }}
                >
                  {field ? (
                    operatorsForKind(field.kind).map((operator) => (
                      <option key={operator} value={operator}>
                        {operatorLabel(operator)}
                      </option>
                    ))
                  ) : (
                    <option value="">Select a field</option>
                  )}
                </select>
                {slots === 2 ? (
                  <span className="crv2-filter-values">
                    <input
                      type="month"
                      aria-label={`From ${n}`}
                      min={MONTH_MIN}
                      max={MONTH_MAX}
                      value={filter.values[0] ?? ''}
                      onChange={(event) => setState((current) => setFilterValue(current, index, 0, event.target.value))}
                    />
                    <input
                      type="month"
                      aria-label={`To ${n}`}
                      min={MONTH_MIN}
                      max={MONTH_MAX}
                      value={filter.values[1] ?? ''}
                      onChange={(event) => setState((current) => setFilterValue(current, index, 1, event.target.value))}
                    />
                  </span>
                ) : null}
                {slots === 1 ? (
                  <input
                    className="crv2-filter-value"
                    type={field?.kind === 'time' ? 'month' : 'text'}
                    aria-label={`Value ${n}`}
                    min={field?.kind === 'time' ? MONTH_MIN : undefined}
                    max={field?.kind === 'time' ? MONTH_MAX : undefined}
                    value={filter.values[0] ?? ''}
                    onChange={(event) => setState((current) => setFilterValue(current, index, 0, event.target.value))}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <button type="button" onClick={() => setState((current) => addFilter(current))}>
        Add filter
      </button>
    </div>
  );
}

export function ReportDemo({
  connect = openBrowserExecutor,
  initialState = preset(),
}: {
  connect?: () => Promise<SqlExecutor>;
  initialState?: DemoState;
}) {
  const [widgets, setWidgets] = useState<CanvasWidget[]>(() => [presetWidget(initialState)]);
  const [selectedId, setSelectedId] = useState('fees');
  const [views, setViews] = useState<Record<string, { phase: 'ready' | 'query-error'; model: VisualModel | null }>>({});
  const [gridWidth, setGridWidth] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [actionsFor, setActionsFor] = useState<string | null>(null);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'load-error'>('loading');
  const [queueReady, setQueueReady] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [queryAttempt, setQueryAttempt] = useState(0);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [fieldQuery, setFieldQuery] = useState('');
  const [groupOpen, setGroupOpen] = useState(true);
  const [aliasesByWidget, setAliasesByWidget] = useState<Record<string, Partial<Record<FieldId, string>>>>({});
  const [renaming, setRenaming] = useState<FieldId | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [menu, setMenu] = useState<{ id: FieldId; x: number; y: number } | null>(null);
  const [hotWell, setHotWell] = useState<WellId | null>(null);
  const [tileTip, setTileTip] = useState<{ x: number; y: number; label: string } | null>(null);
  const [sourceTip, setSourceTip] = useState<{ x: number; y: number; title: string } | null>(null);
  const [vizOpen, setVizOpen] = useState(true);
  const [dataOpen, setDataOpen] = useState(true);
  const [vizWidth, setVizWidth] = useState(280);
  const [dataWidth, setDataWidth] = useState(320);
  const [refused, setRefused] = useState<string | null>(null);
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 800px)').matches);
  const [sample, setSample] = useState<{ pinned: boolean; x: number; y: number; status: 'loading' | 'ready' | 'error'; rows: QueryRow[] } | null>(null);
  const renameCancel = useRef(false);
  const sampleClose = useRef<number | null>(null);
  const sampleRequest = useRef(0);
  const token = useRef(0);
  const widgetSeq = useRef(1);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const queueRef = useRef<Queue | null>(null);
  const widgetsRef = useRef(widgets);
  const selectedIdRef = useRef(selectedId);
  widgetsRef.current = widgets;
  selectedIdRef.current = selectedId;
  const selected = widgets.find((widget) => widget.id === selectedId) ?? widgets[0] ?? null;
  const state = selected?.state ?? initialState;
  const aliases = aliasesByWidget[selected?.id ?? ''] ?? {};
  const setState = (update: DemoState | ((current: DemoState) => DemoState)) => {
    const id = selectedIdRef.current;
    setWidgets((current) =>
      current.map((widget) => {
        if (widget.id !== id) return widget;
        const next = typeof update === 'function' ? update(widget.state) : update;
        return next === widget.state ? widget : { ...widget, state: next };
      }),
    );
  };
  const setAliases = (update: Partial<Record<FieldId, string>> | ((current: Partial<Record<FieldId, string>>) => Partial<Record<FieldId, string>>)) => {
    const id = selectedIdRef.current;
    setAliasesByWidget((current) => {
      const prev = current[id] ?? {};
      const next = typeof update === 'function' ? update(prev) : update;
      return { ...current, [id]: next };
    });
  };
  const connectRef = useRef(connect);
  connectRef.current = connect;
  const vizVisible = narrow || vizOpen;
  const dataVisible = narrow ? fieldsOpen : dataOpen;

  useEffect(() => {
    if (!sample?.pinned) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSample(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sample?.pinned]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 800px)');
    const onChange = () => setNarrow(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  const placed = new Set(wellsOf(state).flatMap((well) => well.fields));
  const queryKey = widgets.map((widget) => `${widget.id}:${widget.family}:${JSON.stringify(widget.state)}`).join('|');

  useEffect(() => {
    let alive = true;
    let release: () => void = () => undefined;
    setPhase('loading');
    setQueueReady(false);
    queueRef.current = null;
    (async () => {
      try {
        const executor = await connectRef.current();
        const response = await fetch(`${import.meta.env.BASE_URL}demo/fee_lines.csv`);
        if (!response.ok) throw new LoadError('missing fee file');
        const csv = await response.text();
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        const ready = loadFeeLines(executor, csv);
        const queue = createQueue(executor);
        queue.holdUntil(gate);
        if (!alive) return;
        queueRef.current = queue;
        setQueueReady(true);
        await ready;
        if (!alive) return;
        release();
      } catch {
        if (!alive) return;
        setPhase('load-error');
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadAttempt]);

  useLayoutEffect(() => {
    const node = gridRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return undefined;
    const update = () => setGridWidth(node.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [phase, widgets.length]);

  useEffect(() => {
    const queue = queueRef.current;
    const list = widgetsRef.current.filter((widget) => widget.family !== 'number-card' && widget.family !== 'slicer');
    if (!queueReady || !queue) {
      token.current += 1;
      if (list.every((widget) => !compile(widget.state).ok)) setPhase('ready');
      return;
    }
    const current = ++token.current;
    const queries: { purpose: 'grid' | 'column-totals' | 'row-totals' | 'grand-total'; sql: string; params: string[] }[] = [];
    const slices: { id: string; state: DemoState; plan: ReturnType<typeof compile>; count: number }[] = [];
    for (const widget of list) {
      const plan = compile(widget.state);
      if (!plan.ok) {
        slices.push({ id: widget.id, state: widget.state, plan, count: 0 });
        continue;
      }
      queries.push(...plan.queries);
      slices.push({ id: widget.id, state: widget.state, plan, count: plan.queries.length });
    }
    if (queries.length === 0) {
      setPhase('ready');
      return;
    }
    queue.run(current, queries).then(
      (result) => {
        if (!result || result.token !== current || token.current !== current) return;
        let cursor = 0;
        const next: Record<string, { phase: 'ready' | 'query-error'; model: VisualModel | null }> = {};
        for (const slice of slices) {
          if (!slice.plan.ok || slice.count === 0) continue;
          const rows = result.rows.slice(cursor, cursor + slice.count);
          cursor += slice.count;
          try {
            next[slice.id] = { phase: 'ready', model: present({ state: slice.state, compiled: slice.plan, results: rows }) };
          } catch {
            next[slice.id] = { phase: 'query-error', model: null };
          }
        }
        setViews((prev) => ({ ...prev, ...next }));
        setPhase('ready');
      },
      () => {
        if (token.current !== current) return;
        const next: Record<string, { phase: 'ready' | 'query-error'; model: VisualModel | null }> = {};
        for (const slice of slices) {
          if (slice.count > 0) next[slice.id] = { phase: 'query-error', model: null };
        }
        setViews((prev) => ({ ...prev, ...next }));
        setPhase('ready');
      },
    );
  }, [queryKey, queueReady, queryAttempt]);

  useEffect(() => {
    if (!sample || sample.status !== 'loading' || !queueReady) return undefined;
    const queue = queueRef.current;
    if (!queue) return undefined;
    const request = ++sampleRequest.current;
    let alive = true;
    queue.sample(previewSql(), []).then(
      (rows) => {
        if (!alive || sampleRequest.current !== request) return;
        setSample((current) => (current ? { ...current, status: 'ready', rows: rows.slice(0, 100) } : current));
      },
      () => {
        if (!alive || sampleRequest.current !== request) return;
        setSample((current) => (current ? { ...current, status: 'error', rows: [] } : current));
      },
    );
    return () => {
      alive = false;
    };
  }, [sample, queueReady]);

  function sampleSpot(target: HTMLElement) {
    const rect = target.getBoundingClientRect();
    const width = Math.min(520, window.innerWidth - 16);
    const height = Math.min(420, window.innerHeight - 16);
    const preferred = rect.left - width - 8;
    const x = Math.max(8, Math.min(preferred, window.innerWidth - width - 8));
    const y = Math.max(8, Math.min(rect.top, window.innerHeight - height - 8));
    return { x, y };
  }

  function cancelSampleClose() {
    if (sampleClose.current !== null) {
      window.clearTimeout(sampleClose.current);
      sampleClose.current = null;
    }
  }

  function scheduleSampleClose() {
    cancelSampleClose();
    sampleClose.current = window.setTimeout(() => {
      setSample((current) => (current?.pinned ? current : null));
    }, 160);
  }

  function showSample(target: HTMLElement, pinned: boolean) {
    cancelSampleClose();
    const spot = sampleSpot(target);
    setSample((current) => (current ? { ...current, ...spot, pinned } : { ...spot, pinned, status: 'loading', rows: [] }));
  }

  function drop(well: WellId, event: DragEvent<HTMLElement>, before?: FieldId) {
    event.preventDefault();
    event.stopPropagation();
    setHotWell(null);
    const id = event.dataTransfer.getData('text/field-id');
    const fromWell = event.dataTransfer.getData('text/well-id');
    if (!isFieldId(id)) return;
    if (before && fromWell === well) {
      setRefused(null);
      setState((current) => moveBefore(current, well, id, before));
      return;
    }
    const next = dropOnWell(state, id, well);
    setState(next);
    setRefused(next === state ? 'That field does not fit this well.' : null);
  }

  function startResize(pane: 'viz' | 'data', event: ReactMouseEvent) {
    event.preventDefault();
    const startX = event.clientX;
    const start = pane === 'viz' ? vizWidth : dataWidth;
    const move = (moveEvent: MouseEvent) => {
      const width = Math.min(520, Math.max(220, start - (moveEvent.clientX - startX)));
      if (pane === 'viz') setVizWidth(width);
      else setDataWidth(width);
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }

  function startRename(id: FieldId) {
    renameCancel.current = false;
    setRenameDraft(aliases[id] ?? shownLabel(id, state, {}));
    setRenaming(id);
    setMenu(null);
  }

  function commitRename(id: FieldId) {
    if (renameCancel.current) {
      renameCancel.current = false;
      setRenaming(null);
      return;
    }
    const next = renameDraft.trim();
    setAliases((current) => {
      const copy = { ...current };
      if (next.length === 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });
    setRenaming(null);
  }

  const visibleFields = FIELDS.filter((field) => field.label.toLowerCase().includes(fieldQuery.trim().toLowerCase()));
  function selectVisual(id: string) {
    const target = selectedIdRef.current;
    setWidgets((current) =>
      current.map((widget) => {
        if (widget.id !== target) return widget;
        if (isChartMark(id)) {
          const next = widget.state.widget === 'chart' ? widget.state : switchWidget(widget.state, 'chart');
          return { ...widget, family: 'chart', note: null, state: { ...next, chartMark: id } };
        }
        if (id === 'table') return { ...widget, family: 'table', note: null, state: switchWidget(widget.state, 'table') };
        if (id === 'pivot-table') return { ...widget, family: 'pivot-table', note: null, state: switchWidget(widget.state, 'pivot') };
        return widget;
      }),
    );
  }
  function parkVisual(label: string) {
    const target = selectedIdRef.current;
    setWidgets((current) => current.map((widget) => (widget.id === target ? { ...widget, note: label } : widget)));
  }
  function addWidget(family: WidgetFamily, mark?: ChartMark) {
    const id = `widget-${widgetSeq.current++}`;
    setWidgets((current) => {
      const plan = planAutoRow(current, family);
      const created = createWidget(family, id, { ...plan.box, z: topLayer(current) + 1 }, mark);
      const siblings = new Map(plan.siblings.map((item) => [item.id, item.box]));
      const next = current.map((widget) => {
        const box = siblings.get(widget.id);
        return box ? { ...widget, box: { ...widget.box, ...box } } : widget;
      });
      return [...next, created];
    });
    setSelectedId(id);
    setAddOpen(false);
  }
  function onCanvasDrop(event: DragEvent<HTMLDivElement>) {
    const id = event.dataTransfer.getData('application/x-crv2-chart');
    if (!id) return;
    event.preventDefault();
    if (id === 'table') addWidget('table');
    else if (id === 'pivot-table') addWidget('pivot-table');
    else if (isChartMark(id)) addWidget('chart', id);
  }
  function applyBox(id: string, box: CanvasWidget['box']) {
    setWidgets((current) => current.map((widget) => (widget.id === id ? { ...widget, box } : widget)));
  }
  function trackPointer(event: ReactPointerEvent, onMove: (dx: number, dy: number) => void) {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const move = (moveEvent: PointerEvent) => onMove(moveEvent.clientX - startX, moveEvent.clientY - startY);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }
  function startWidgetDrag(widget: CanvasWidget, event: ReactPointerEvent) {
    const origin = widget.box;
    const z = topLayer(widgetsRef.current) + 1;
    setSelectedId(widget.id);
    applyBox(widget.id, { ...origin, z });
    trackPointer(event, (dx, dy) => {
      const delta = cellDelta(gridRef.current?.clientWidth ?? 0, dx, dy);
      applyBox(widget.id, { ...clampMove(origin, delta.x, delta.y), z });
    });
  }
  function startWidgetResize(widget: CanvasWidget, event: ReactPointerEvent) {
    const origin = widget.box;
    trackPointer(event, (dx, dy) => {
      const delta = cellDelta(gridRef.current?.clientWidth ?? 0, dx, dy);
      applyBox(widget.id, clampResize(origin, delta.x, delta.y));
    });
  }
  function insertWidget(anchor: CanvasWidget) {
    const id = `widget-${widgetSeq.current++}`;
    const spot = insertBeside(anchor.box);
    setWidgets((current) => [...current, createWidget('chart', id, { ...spot, z: topLayer(current) + 1 })]);
    setSelectedId(id);
  }
  function duplicateWidget(widget: CanvasWidget) {
    const id = `widget-${widgetSeq.current++}`;
    const spot = duplicateBelow(widget.box);
    setWidgets((current) => [
      ...current,
      { ...widget, id, name: `${widget.name} (Copy)`, box: { ...spot, z: topLayer(current) + 1 }, state: structuredClone(widget.state) },
    ]);
    setAliasesByWidget((current) => ({ ...current, [id]: { ...(current[widget.id] ?? {}) } }));
    setSelectedId(id);
    setActionsFor(null);
  }
  function deleteWidget(id: string) {
    const remaining = widgetsRef.current.filter((widget) => widget.id !== id);
    setWidgets(remaining);
    if (selectedIdRef.current === id) setSelectedId(remaining[0]?.id ?? '');
    setActionsFor(null);
  }
  function widgetVisual(widget: CanvasWidget) {
    if (widget.family === 'number-card' || widget.family === 'slicer') {
      return <p className="crv2-note">{widget.note ?? widget.name} is not in this demo.</p>;
    }
    const plan = compile(widget.state);
    if (!plan.ok) return <p role="status">{guidance(plan.reason)}</p>;
    const view = views[widget.id];
    if (view?.phase === 'query-error') {
      return (
        <div role="alert">
          <p>This view couldn't be calculated.</p>
          <button type="button" onClick={() => setQueryAttempt((attempt) => attempt + 1)}>
            Retry
          </button>
        </div>
      );
    }
    if (view?.model) {
      return (
        <ReportVisual
          key={`${widget.id}:${widget.state.widget}:${widget.state.chartMark}`}
          model={withAliases(view.model, widget.state, aliasesByWidget[widget.id] ?? {})}
        />
      );
    }
    return <p role="status">Loading the demo data.</p>;
  }

  return (
    <section id="report" aria-labelledby="report-heading">
      <header className="crv2-top">
        <div>
          <h2 id="report-heading">Fees</h2>
          <p>Synthetic. Not a client.</p>
        </div>
      </header>
      <div className="crv2-tab">
        <span>Report</span>
      </div>
      <div className="crv2">
        <div className="crv2-canvas">
          <div className="crv2-canvas-bar">
            <p className="crv2-note">Pick fields, filter, and read a table, a pivot, or a chart. The numbers are synthetic fees, queried in your browser.</p>
            <div className="crv2-add">
              <button type="button" aria-expanded={addOpen} aria-haspopup="menu" onClick={() => setAddOpen((open) => !open)}>
                Add Widget
              </button>
              {addOpen ? (
                <div className="crv2-add-menu" role="menu">
                  {(
                    [
                      ['number-card', 'Number card'],
                      ['chart', 'Chart'],
                      ['table', 'Data Table'],
                      ['pivot-table', 'Pivot Table'],
                      ['slicer', 'Slicer'],
                    ] as const
                  ).map(([family, label]) => (
                    <button key={family} type="button" role="menuitem" onClick={() => addWidget(family)}>
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <LineagePath mode="report" />
          {phase === 'load-error' ? (
            <div role="alert">
              <p>This demo couldn't load.</p>
              <button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
                Retry
              </button>
            </div>
          ) : null}
          {phase === 'loading' ? <p role="status">Loading the demo data.</p> : null}
          {phase !== 'loading' && phase !== 'load-error' && widgets.length === 0 ? (
            <div className="crv2-empty-state">
              <strong>Still Empty!</strong>
              <p>
                <button type="button" onClick={() => setAddOpen(true)}>
                  Add widgets
                </button>{' '}
                to start building your report.
              </p>
            </div>
          ) : null}
          {phase !== 'loading' && phase !== 'load-error' && widgets.length > 0 ? (
            <div
              className="crv2-grid"
              data-testid="report-canvas"
              ref={gridRef}
              style={{ height: canvasHeight(widgets.map((widget) => widget.box)) }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={onCanvasDrop}
            >
              {widgets.map((widget) => {
                const frame = boxFrame(widget.box, gridWidth);
                return (
                  <article
                    key={widget.id}
                    className={widget.id === selected?.id ? 'crv2-widget is-selected' : 'crv2-widget'}
                    data-grid-x={widget.box.x}
                    data-grid-y={widget.box.y}
                    data-grid-w={widget.box.w}
                    data-grid-h={widget.box.h}
                    style={{ left: frame.left, top: frame.top, width: frame.width, height: frame.height, zIndex: widget.box.z }}
                    onClick={() => setSelectedId(widget.id)}
                  >
                    <header className="crv2-widget-head">
                      <button type="button" className="crv2-widget-handle" aria-label="Drag to move widget" onPointerDown={(event) => startWidgetDrag(widget, event)}>
                        ⠿
                      </button>
                      <h3>{widget.name}</h3>
                      <button
                        type="button"
                        className="crv2-widget-menu"
                        aria-label={`Actions for ${widget.name}`}
                        aria-expanded={actionsFor === widget.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          setActionsFor((current) => (current === widget.id ? null : widget.id));
                        }}
                      >
                        ⋯
                      </button>
                    </header>
                    {actionsFor === widget.id ? (
                      <div className="crv2-add-menu crv2-widget-actions" role="menu">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={(event) => {
                            event.stopPropagation();
                            duplicateWidget(widget);
                          }}
                        >
                          Duplicate
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteWidget(widget.id);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                    {widget.note && widget.family !== 'number-card' && widget.family !== 'slicer' ? (
                      <p className="crv2-note">{widget.note} is not in this demo.</p>
                    ) : null}
                    <div className="crv2-widget-body">{widgetVisual(widget)}</div>
                    <button
                      type="button"
                      className="crv2-insert"
                      aria-label="Insert widget"
                      onClick={(event) => {
                        event.stopPropagation();
                        insertWidget(widget);
                      }}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="crv2-widget-resize"
                      aria-label="Resize widget"
                      onPointerDown={(event) => startWidgetResize(widget, event)}
                    />
                  </article>
                );
              })}
            </div>
          ) : null}
        </div>
        {vizVisible ? (
          <section className="crv2-viz" aria-label="Visualizations" style={narrow ? undefined : { width: vizWidth }}>
            {narrow ? null : <div className="crv2-resize" onMouseDown={(event) => startResize('viz', event)} />}
            <div className="crv2-pane-head">
              <h2>Visualizations</h2>
              {narrow ? null : (
                <button type="button" aria-label="Collapse visualizations" onClick={() => setVizOpen(false)}>
                  ›
                </button>
              )}
            </div>
            <div className="crv2-scroll">
              {VISUALS.map((group) => (
                <div key={group.group}>
                  <p className="crv2-group">{group.group}</p>
                  <div className="crv2-tiles">
                    {group.items.map((item) => {
                      const pressed = item.id === 'table'
                        ? state.widget === 'table'
                        : item.id === 'pivot-table'
                          ? state.widget === 'pivot'
                          : state.widget === 'chart' && state.chartMark === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={item.live ? 'crv2-tile' : 'crv2-tile is-off'}
                          aria-label={item.label}
                          aria-pressed={item.live ? pressed : false}
                          draggable={item.live}
                          onDragStart={(event) => {
                            if (!item.live) return;
                            event.dataTransfer.setData('application/x-crv2-chart', item.id);
                            event.dataTransfer.setData('text/plain', item.label);
                          }}
                          onMouseEnter={(event) => setTileTip({ x: event.clientX + 12, y: event.clientY + 12, label: item.label })}
                          onMouseLeave={() => setTileTip(null)}
                          onClick={() => {
                            setTileTip(null);
                            if (!item.live) {
                              parkVisual(item.label);
                              return;
                            }
                            selectVisual(item.id);
                          }}
                        >
                          <TileGlyph id={item.id} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {wellsOf(state).map((well) => (
                <div key={well.id} className="crv2-well">
                  <p>{well.label}</p>
                  <ul
                    aria-label={well.label}
                    className={hotWell === well.id ? 'crv2-well-hot' : undefined}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setHotWell(well.id);
                    }}
                    onDragLeave={(event) => {
                      if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                      setHotWell((current) => (current === well.id ? null : current));
                    }}
                    onDrop={(event) => drop(well.id, event)}
                  >
                    {well.fields.length === 0 ? <li className="crv2-empty">Add data fields here</li> : null}
                    {well.fields.map((id) => {
                      const label = fieldById(id)?.label ?? id;
                      return (
                        <li
                          key={id}
                          className="crv2-chip"
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.setData('text/field-id', id);
                            event.dataTransfer.setData('text/well-id', well.id);
                            event.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => drop(well.id, event, id)}
                        >
                          <button type="button" className="crv2-grip" aria-label="Reorder" tabIndex={-1}>
                            ⋮
                          </button>
                          {renaming === id ? (
                            <input
                              aria-label={`Rename ${label}`}
                              value={renameDraft}
                              autoFocus
                              onChange={(event) => setRenameDraft(event.target.value)}
                              onBlur={() => commitRename(id)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') event.currentTarget.blur();
                                if (event.key === 'Escape') {
                                  renameCancel.current = true;
                                  event.currentTarget.blur();
                                }
                              }}
                            />
                          ) : (
                            <span
                              onDoubleClick={() => startRename(id)}
                              onMouseEnter={(event) => setSourceTip({ x: event.clientX, y: event.clientY + 16, title: label })}
                              onMouseLeave={() => setSourceTip(null)}
                            >
                              {shownLabel(id, state, aliases)}
                            </span>
                          )}
                          <button
                            type="button"
                            aria-label="Field options"
                            onClick={(event) => {
                              const rect = event.currentTarget.getBoundingClientRect();
                              setMenu({ id, x: rect.left, y: rect.bottom + 4 });
                            }}
                          >
                            ▾
                          </button>
                          <button type="button" aria-label={`Remove ${label}`} onClick={() => setState((current) => removeField(current, id))}>
                            ×
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              {refused ? <p className="crv2-note">{refused}</p> : null}
              <FilterRows state={state} setState={setState} />
            </div>
          </section>
        ) : (
          <button type="button" className="crv2-rail" aria-label="Expand visualizations" onClick={() => setVizOpen(true)}>
            Visualizations
          </button>
        )}
        {narrow ? (
          <button type="button" className="crv2-data-toggle" aria-expanded={fieldsOpen} onClick={() => setFieldsOpen((open) => !open)}>
            Data
          </button>
        ) : null}
        {dataVisible ? (
          <section className="crv2-data" aria-label="Data" style={narrow ? undefined : { width: dataWidth }}>
            {narrow ? null : <div className="crv2-resize" onMouseDown={(event) => startResize('data', event)} />}
            <div className="crv2-pane-head">
              <h2>Data</h2>
              {narrow ? null : (
                <button type="button" aria-label="Collapse data pane" onClick={() => setDataOpen(false)}>
                  ›
                </button>
              )}
            </div>
            <div className="crv2-scroll">
              <div className="crv2-search">
                <input
                  type="search"
                  placeholder="Search"
                  aria-label="Search"
                  value={fieldQuery}
                  onChange={(event) => setFieldQuery(event.target.value)}
                />
              </div>
              <div className="crv2-source-row">
                <button type="button" className="crv2-source" aria-expanded={groupOpen} onClick={() => setGroupOpen((open) => !open)}>
                  <TableGlyph />
                  Fee lines
                </button>
                <button
                  type="button"
                  className="crv2-preview-btn"
                  aria-label="Preview"
                  aria-pressed={sample?.pinned ?? false}
                  onMouseEnter={(event) => showSample(event.currentTarget, sample?.pinned ?? false)}
                  onMouseLeave={scheduleSampleClose}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (sample?.pinned) setSample(null);
                    else showSample(event.currentTarget, true);
                  }}
                >
                  <EyeGlyph />
                </button>
              </div>
              {groupOpen
                ? visibleFields.map((field) => (
                    <div
                      key={field.id}
                      role="checkbox"
                      aria-checked={placed.has(field.id)}
                      tabIndex={0}
                      className="crv2-field"
                      draggable
                      onDragStart={(event) => event.dataTransfer.setData('text/field-id', field.id)}
                      onClick={() => setState((current) => (placed.has(field.id) ? removeField(current, field.id) : addField(current, field.id)))}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setState((current) => (placed.has(field.id) ? removeField(current, field.id) : addField(current, field.id)));
                        }
                      }}
                    >
                      <span className="crv2-box" aria-hidden="true" />
                      <FieldTypeMark kind={field.kind} />
                      <span>{field.label}</span>
                    </div>
                  ))
                : null}
            </div>
          </section>
        ) : narrow ? null : (
          <button type="button" className="crv2-rail" aria-label="Expand data pane" onClick={() => setDataOpen(true)}>
            Data
          </button>
        )}
      </div>
      {sample ? (
        <div
          className="crv2-preview"
          role={sample.pinned ? 'dialog' : 'region'}
          aria-label="Fee lines"
          style={{ left: sample.x, top: sample.y }}
          onMouseEnter={cancelSampleClose}
          onMouseLeave={scheduleSampleClose}
        >
          <header>
            <div>
              <p>Fee lines</p>
              <p>{sample.status === 'ready' ? `${sample.rows.length} sample rows` : '100 sample rows'}</p>
            </div>
            {sample.pinned ? (
              <button type="button" aria-label="Close" onClick={() => setSample(null)}>
                ×
              </button>
            ) : null}
          </header>
          {sample.status === 'loading' ? <p>Loading...</p> : null}
          {sample.status === 'error' ? <p role="alert">This preview couldn't load.</p> : null}
          {sample.status === 'ready' && sample.rows.length === 0 ? <p>No rows</p> : null}
          {sample.status === 'ready' && sample.rows.length > 0 ? (
            <div className="crv2-preview-scroll">
              <table>
                <thead>
                  <tr>
                    {PREVIEW_COLUMNS.map((column) => (
                      <th key={column.name}>
                        <span>{column.label}</span>
                        <span>{column.type}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sample.rows.map((row, index) => (
                    <tr key={index}>
                      {PREVIEW_COLUMNS.map((column) => {
                        const value = row[column.name];
                        return <td key={column.name}>{value == null || value === '' ? '—' : String(value)}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
      {tileTip ? (
        <div className="crv2-tip" style={{ left: tileTip.x, top: tileTip.y }} role="tooltip">
          {tileTip.label}
        </div>
      ) : null}
      {sourceTip ? (
        <div className="crv2-tip" style={{ left: sourceTip.x, top: sourceTip.y }} role="tooltip">
          <strong>{sourceTip.title}</strong>
          <span>Source table: Fee lines</span>
        </div>
      ) : null}
      {menu ? (
        <div className="crv2-menu-back" onClick={() => setMenu(null)}>
          <div className="crv2-menu" role="menu" style={{ left: menu.x, top: menu.y }} onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                const id = menu.id;
                setMenu(null);
                setState((current) => removeField(current, id));
              }}
            >
              Remove field
            </button>
            <button type="button" role="menuitem" onClick={() => startRename(menu.id)}>
              Rename for this visual
            </button>
            {menu.id === 'amount' ? (
              <>
                <div className="crv2-menu-rule" />
                {AGG_OPTIONS.map(([value, option]) => (
                  <button
                    key={value}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setState((current) => setAgg(current, 'amount', value));
                      setMenu(null);
                    }}
                  >
                    <span>{(state.measureAgg.amount ?? 'sum') === value ? '✓' : ''}</span>
                    {option}
                  </button>
                ))}
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
