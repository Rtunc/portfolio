import { useEffect, useRef, useState, type DragEvent } from 'react';
import { FIELDS, MONTH_MAX, MONTH_MIN, SITES, fieldById, isFieldId } from '../demo/catalog';
import { compile } from '../demo/compile';
import { openBrowserExecutor } from '../demo/browser-db';
import { LoadError, createQueue, loadFeeLines, type SqlExecutor } from '../demo/engine';
import { present } from '../demo/shape';
import { addField, dropOnWell, preset, removeField, setAgg, setMonths, setSites, switchWidget } from '../demo/state';
import type { DemoState, FieldId, VisualModel, WellId } from '../demo/types';
import { guidance } from '../demo/types';
import { ReportVisual } from './ReportVisual';

type Queue = ReturnType<typeof createQueue>;

const AGG_OPTIONS = [
  ['sum', 'Sum'],
  ['avg', 'Average'],
  ['count', 'Count'],
] as const;

const VISUALS: { group: string; items: { id: string; label: string; live: boolean }[] }[] = [
  { group: 'Pie', items: [{ id: 'pie', label: 'Pie', live: false }, { id: 'donut', label: 'Donut', live: false }] },
  {
    group: 'Column',
    items: [
      { id: 'column', label: 'Clustered column', live: true },
      { id: 'column-stacked', label: 'Stacked column', live: false },
      { id: 'column-stacked-100', label: '100% stacked column', live: false },
      { id: 'column-line', label: 'Column and line', live: false },
    ],
  },
  {
    group: 'Bar',
    items: [
      { id: 'bar', label: 'Clustered bar', live: false },
      { id: 'bar-stacked', label: 'Stacked bar', live: false },
      { id: 'bar-stacked-100', label: '100% stacked bar', live: false },
    ],
  },
  {
    group: 'Line',
    items: [
      { id: 'line', label: 'Line', live: true },
      { id: 'line-markers', label: 'Line with markers', live: false },
      { id: 'line-stepped', label: 'Stepped line', live: false },
    ],
  },
  {
    group: 'Area',
    items: [
      { id: 'area', label: 'Area', live: false },
      { id: 'area-stacked', label: 'Stacked area', live: false },
      { id: 'area-stacked-100', label: '100% stacked area', live: false },
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

function shownLabel(id: FieldId, state: DemoState): string {
  const field = fieldById(id);
  if (!field || field.kind !== 'measure') return field?.label ?? id;
  const agg = id === 'amount' ? state.measureAgg.amount ?? 'sum' : field.defaultAgg;
  const word = agg === 'avg' ? 'Average' : agg === 'count' ? 'Count' : agg === 'count_distinct' ? 'Count distinct' : 'Sum';
  return `${word} of ${field.label}`;
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
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 800px)').matches);
  const token = useRef(0);
  const queueRef = useRef<Queue | null>(null);
  const connectRef = useRef(connect);
  connectRef.current = connect;
  const showFields = !narrow || fieldsOpen;

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

  function drop(well: WellId, event: DragEvent<HTMLElement>) {
    event.preventDefault();
    const id = event.dataTransfer.getData('text/field-id');
    if (!isFieldId(id)) return;
    setState((current) => dropOnWell(current, id, well));
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
    visual = <ReportVisual model={model} />;
  }

  const visibleFields = FIELDS.filter((field) => field.label.toLowerCase().includes(fieldQuery.trim().toLowerCase()));
  function selectVisual(id: string) {
    setState((current) => {
      if (id === 'column' || id === 'line') {
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
            {visual}
          </div>
        </div>
        <section className="crv2-viz" aria-label="Visualizations">
          <div className="crv2-pane-head">
            <h2>Visualizations</h2>
          </div>
          <div className="crv2-scroll">
            {VISUALS.map((group) => (
              <div key={group.group}>
                <p className="crv2-group">{group.group}</p>
                <div className="crv2-tiles">
                  {group.items.map((item) => {
                    const pressed =
                      (item.id === 'column' && state.widget === 'chart' && state.chartMark === 'column')
                      || (item.id === 'line' && state.widget === 'chart' && state.chartMark === 'line')
                      || (item.id === 'table' && state.widget === 'table')
                      || (item.id === 'pivot-table' && state.widget === 'pivot');
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className="crv2-tile"
                        aria-label={item.label}
                        aria-pressed={pressed}
                        aria-disabled={!item.live}
                        onClick={() => {
                          if (item.live) selectVisual(item.id);
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
                <ul aria-label={well.label} onDragOver={(event) => event.preventDefault()} onDrop={(event) => drop(well.id, event)}>
                  {well.fields.length === 0 ? <li className="crv2-empty">Add data fields here</li> : null}
                  {well.fields.map((id) => {
                    const label = fieldById(id)?.label ?? id;
                    return (
                      <li key={id} className="crv2-chip">
                        <span>{shownLabel(id, state)}</span>
                        {id === 'amount' ? (
                          <select
                            aria-label="Amount aggregation"
                            value={state.measureAgg.amount ?? 'sum'}
                            onChange={(event) => {
                              const agg = event.target.value;
                              if (agg === 'sum' || agg === 'avg' || agg === 'count') setState((current) => setAgg(current, 'amount', agg));
                            }}
                          >
                            {AGG_OPTIONS.map(([value, option]) => (
                              <option key={value} value={value}>
                                {option}
                              </option>
                            ))}
                          </select>
                        ) : null}
                        <button type="button" aria-label={`Remove ${label}`} onClick={() => setState((current) => removeField(current, id))}>
                          ×
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
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
        {narrow ? (
          <button type="button" className="crv2-data-toggle" aria-expanded={fieldsOpen} onClick={() => setFieldsOpen((open) => !open)}>
            Data
          </button>
        ) : null}
        {showFields ? (
          <section className="crv2-data" aria-label="Data">
            <div className="crv2-pane-head">
              <h2>Data</h2>
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
              <div className="crv2-source">Fee lines</div>
              {visibleFields.map((field) => (
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
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}
