import { useEffect, useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { FIELDS, MONTH_MAX, MONTH_MIN, SITES, fieldById, isFieldId } from '../demo/catalog';
import { compile } from '../demo/compile';
import { openBrowserExecutor } from '../demo/browser-db';
import { LoadError, createQueue, loadFeeLines, type SqlExecutor } from '../demo/engine';
import { present } from '../demo/shape';
import { addField, dropOnWell, preset, removeField, setAgg, setMonths, setSites, switchWidget } from '../demo/state';
import type { ChartMark, DemoState, FieldId, VisualModel, WellId } from '../demo/types';
import { guidance } from '../demo/types';
import { LineagePath } from './LineagePath';
import { ReportVisual } from './ReportVisual';

type Queue = ReturnType<typeof createQueue>;

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

export function ReportDemo({
  connect = openBrowserExecutor,
  initialState = preset(),
}: {
  connect?: () => Promise<SqlExecutor>;
  initialState?: DemoState;
}) {
  const [state, setState] = useState(initialState);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'load-error' | 'query-error'>('loading');
  const [model, setModel] = useState<VisualModel | null>(null);
  const [queueReady, setQueueReady] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [queryAttempt, setQueryAttempt] = useState(0);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [fieldQuery, setFieldQuery] = useState('');
  const [groupOpen, setGroupOpen] = useState(true);
  const [aliases, setAliases] = useState<Partial<Record<FieldId, string>>>({});
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
  const [unsupported, setUnsupported] = useState<string | null>(null);
  const [refused, setRefused] = useState<string | null>(null);
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 800px)').matches);
  const renameCancel = useRef(false);
  const token = useRef(0);
  const queueRef = useRef<Queue | null>(null);
  const connectRef = useRef(connect);
  connectRef.current = connect;
  const vizVisible = narrow || vizOpen;
  const dataVisible = narrow ? fieldsOpen : dataOpen;

  useEffect(() => {
    const media = window.matchMedia('(max-width: 800px)');
    const onChange = () => setNarrow(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  const compiled = compile(state);
  const guidanceMessage = compiled.ok ? null : guidance(compiled.reason);
  const placed = new Set(wellsOf(state).flatMap((well) => well.fields));

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

  useEffect(() => {
    const queue = queueRef.current;
    const next = state;
    const plan = compile(next);
    if (!plan.ok || !queueReady || !queue) {
      token.current += 1;
      if (!plan.ok) setPhase('ready');
      return;
    }
    const current = ++token.current;
    queue.run(current, plan.queries).then(
      (result) => {
        if (!result || result.token !== current || token.current !== current) return;
        setModel(present({ state: next, compiled: plan, results: result.rows }));
        setPhase('ready');
      },
      () => {
        if (token.current !== current) return;
        setPhase('query-error');
      },
    );
  }, [state, queueReady, queryAttempt]);

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

  let visual = <p role="status">Loading the demo data.</p>;
  if (phase === 'load-error') {
    visual = (
      <div role="alert">
        <p>This demo couldn't load.</p>
        <button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
          Retry
        </button>
      </div>
    );
  } else if (phase === 'query-error') {
    visual = (
      <div role="alert">
        <p>This view couldn't be calculated.</p>
        <button type="button" onClick={() => setQueryAttempt((attempt) => attempt + 1)}>
          Retry
        </button>
      </div>
    );
  } else if (guidanceMessage) {
    visual = <p role="status">{guidanceMessage}</p>;
  } else if (model) {
    visual = <ReportVisual key={`${state.widget}:${state.chartMark}`} model={withAliases(model, state, aliases)} />;
  }

  const visibleFields = FIELDS.filter((field) => field.label.toLowerCase().includes(fieldQuery.trim().toLowerCase()));
  function selectVisual(id: string) {
    setUnsupported(null);
    setState((current) => {
      if (isChartMark(id)) {
        const next = current.widget === 'chart' ? current : switchWidget(current, 'chart');
        return { ...next, chartMark: id };
      }
      if (id === 'table') return switchWidget(current, 'table');
      if (id === 'pivot-table') return switchWidget(current, 'pivot');
      return current;
    });
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
          <div className="crv2-card">
            <h3>Fees</h3>
            <p className="crv2-note">Pick fields, filter, and read a table, a pivot, or a chart. The numbers are synthetic fees, queried in your browser.</p>
            <LineagePath mode="report" />
            {unsupported ? <p className="crv2-note">{unsupported} is not in this demo.</p> : null}
            {visual}
          </div>
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
                          onMouseEnter={(event) => setTileTip({ x: event.clientX + 12, y: event.clientY + 12, label: item.label })}
                          onMouseLeave={() => setTileTip(null)}
                          onClick={() => {
                            setTileTip(null);
                            if (!item.live) {
                              setUnsupported(item.label);
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
              <div className="crv2-filters">
                <p>Filters</p>
                <fieldset>
                  <legend>Sites</legend>
                  {SITES.map((site) => (
                    <label key={site}>
                      <input
                        type="checkbox"
                        checked={state.sites.includes(site)}
                        onChange={(event) => {
                          const next = event.target.checked ? [...state.sites, site] : state.sites.filter((item) => item !== site);
                          setState((current) => setSites(current, next));
                        }}
                      />
                      {site}
                    </label>
                  ))}
                </fieldset>
                <label>
                  Start month
                  <input
                    type="month"
                    min={MONTH_MIN}
                    max={MONTH_MAX}
                    value={state.monthStart}
                    onChange={(event) => setState((current) => setMonths(current, event.target.value, current.monthEnd))}
                  />
                </label>
                <label>
                  End month
                  <input
                    type="month"
                    min={MONTH_MIN}
                    max={MONTH_MAX}
                    value={state.monthEnd}
                    onChange={(event) => setState((current) => setMonths(current, current.monthStart, event.target.value))}
                  />
                </label>
              </div>
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
              <button type="button" className="crv2-source" aria-expanded={groupOpen} onClick={() => setGroupOpen((open) => !open)}>
                Fee lines
              </button>
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
