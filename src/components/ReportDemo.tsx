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
    { id: 'chartX', label: 'X', fields: state.chartX ? [state.chartX] : [] },
    { id: 'chartY', label: 'Y', fields: state.chartY },
    { id: 'chartSeries', label: 'Series', fields: state.chartSeries ? [state.chartSeries] : [] },
  ];
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

  function drop(well: WellId, event: DragEvent<HTMLUListElement>) {
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

  return (
    <section id="report" aria-labelledby="report-heading">
      <h2 id="report-heading">Report</h2>
      <p>Synthetic. Not a client.</p>
      <p>Pick fields, filter, and read a table, a pivot, or a chart. The numbers are synthetic fees, queried in your browser.</p>
      <div className="report-layout">
        <div>
          {narrow ? (
            <button type="button" aria-expanded={fieldsOpen} onClick={() => setFieldsOpen((open) => !open)}>
              Fields
            </button>
          ) : null}
          {showFields ? (
            <div className="field-list">
              {FIELDS.map((field) => (
                <button
                  key={field.id}
                  type="button"
                  draggable
                  onDragStart={(event) => event.dataTransfer.setData('text/field-id', field.id)}
                  onClick={() => setState((current) => addField(current, field.id))}
                >
                  {field.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div>
          <div className="widget-switch">
            <button type="button" aria-pressed={state.widget === 'table'} onClick={() => setState((current) => switchWidget(current, 'table'))}>
              Data table
            </button>
            <button type="button" aria-pressed={state.widget === 'pivot'} onClick={() => setState((current) => switchWidget(current, 'pivot'))}>
              Pivot
            </button>
            <button type="button" aria-pressed={state.widget === 'chart'} onClick={() => setState((current) => switchWidget(current, 'chart'))}>
              Chart
            </button>
            {state.widget === 'chart' ? (
              <>
                <button type="button" aria-pressed={state.chartMark === 'column'} onClick={() => setState((current) => ({ ...current, chartMark: 'column' }))}>
                  Column
                </button>
                <button type="button" aria-pressed={state.chartMark === 'line'} onClick={() => setState((current) => ({ ...current, chartMark: 'line' }))}>
                  Line
                </button>
              </>
            ) : null}
          </div>
          {wellsOf(state).map((well) => (
            <div key={well.id}>
              <ul
                aria-label={well.label}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => drop(well.id, event)}
              >
                {well.fields.map((id) => {
                  const label = fieldById(id)?.label ?? id;
                  return (
                    <li key={id}>
                      {label}
                      <button type="button" aria-label={`Remove ${label}`} onClick={() => setState((current) => removeField(current, id))}>
                        Remove
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {placed.has('amount') ? (
            <label>
              Amount aggregation
              <select
                aria-label="Amount aggregation"
                value={state.measureAgg.amount ?? 'sum'}
                onChange={(event) => {
                  const agg = event.target.value;
                  if (agg === 'sum' || agg === 'avg' || agg === 'count') setState((current) => setAgg(current, 'amount', agg));
                }}
              >
                {AGG_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <fieldset>
            <legend>Sites</legend>
            {SITES.map((site) => (
              <label key={site}>
                <input
                  type="checkbox"
                  checked={state.sites.includes(site)}
                  onChange={(event) => {
                    const next = event.target.checked
                      ? [...state.sites, site]
                      : state.sites.filter((item) => item !== site);
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
        <div>{visual}</div>
      </div>
    </section>
  );
}
