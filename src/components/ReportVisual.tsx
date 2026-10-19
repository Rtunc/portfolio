import { useState } from 'react';
import type { ChartModel, VisualModel } from '../demo/types';

const COLORS = ['#00b8ec', '#11b14b', '#f4811f', '#833cf0', '#ee4056', '#ffcb06', '#0288bf', '#a5cd39'];

export function ReportVisual({ model }: { model: VisualModel }) {
  const [hidden, setHidden] = useState<string[]>([]);
  const [tip, setTip] = useState<{ x: number; y: number; title: string; body: string } | null>(null);
  const showTip = (event: { clientX: number; clientY: number }, title: string, body: string) => {
    setTip({ x: event.clientX + 12, y: event.clientY + 12, title, body });
  };
  const toggleSeries = (name: string) => {
    setHidden((current) => (current.includes(name) ? current.filter((item) => item !== name) : [...current, name]));
  };
  if (model.kind === 'guidance' || model.kind === 'empty') {
    return <p role="status">{model.message}</p>;
  }
  if (model.kind === 'table') {
    return (
      <div>
        <table>
          <thead>
            <tr>
              {model.headers.map((header) => (
                <th key={header} scope="col">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell ?? ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {model.caption ? <p role="status">{model.caption}</p> : null}
      </div>
    );
  }
  if (model.kind === 'pivot') {
    return (
      <div>
        {model.singleCell ? (
          <p>{model.grand?.join(' · ')}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{model.columnLabels.length === 0 ? model.measureLabels.join(' · ') : ''}</th>
                {model.columnLabels.map((label) => (
                  <th key={label} scope="col">
                    {model.measureLabels.length > 1 ? `${label} (${model.measureLabels.join(' · ')})` : label}
                  </th>
                ))}
                {model.rowTotals ? (
                  <th scope="col">Total</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {model.body.map((row, rowIndex) => (
                <tr key={model.rowLabels[rowIndex] ?? rowIndex}>
                  <th scope="row">{model.rowLabels[rowIndex] ?? ''}</th>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{cell.every((value) => value == null) ? '' : cell.join(' · ')}</td>
                  ))}
                  {model.rowTotals ? <td>{model.rowTotals[rowIndex]?.join(' · ') ?? ''}</td> : null}
                </tr>
              ))}
              {model.columnTotals || model.grand ? (
                <tr>
                  <th scope="row">Total</th>
                  {model.columnTotals ? (
                    model.columnTotals.map((cell, index) => <td key={index}>{cell.join(' · ')}</td>)
                  ) : (
                    <td>{model.grand?.join(' · ')}</td>
                  )}
                  {model.rowTotals ? <td>{model.grand?.join(' · ') ?? ''}</td> : null}
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
        <p>{model.totalsNote}</p>
        {model.caption ? <p role="status">{model.caption}</p> : null}
      </div>
    );
  }
  if (model.mark !== 'column' && model.mark !== 'line') {
    return <ChartVariant model={model} hidden={hidden} onToggle={toggleSeries} onTip={showTip} onLeave={() => setTip(null)} tip={tip} />;
  }
  const height = 280;
  const width = 640;
  const colors = COLORS;
  const plotLeft = 8;
  const plotRight = 620;
  const plotTop = 12 + model.series.length * 16;
  const plotBottom = 168;
  const slot = model.xLabels.length === 0 ? plotRight - plotLeft : (plotRight - plotLeft) / model.xLabels.length;
  const barWidth = Math.max(1, (slot - 4) / Math.max(1, model.series.length));
  const max = Math.max(1, ...model.series.flatMap((series) => series.values.map((value) => value ?? 0)));
  const barHeight = (value: number | null) => ((value ?? 0) / max) * (plotBottom - plotTop);
  return (
    <div>
      <svg data-testid="chart" role="img" viewBox={`0 0 ${width} ${height}`} width="100%" height="280">
        {model.series.map((series, seriesIndex) => (
          <g key={series.name}>
            <text
              x="8"
              y={16 + seriesIndex * 16}
              fill={colors[seriesIndex % colors.length]}
              opacity={hidden.includes(series.name) ? 0.35 : 1}
              style={{ cursor: 'pointer' }}
              onClick={() => toggleSeries(series.name)}
            >
              {series.name}
            </text>
            {hidden.includes(series.name) ? null : model.mark === 'line' ? (
              <polyline
                fill="none"
                stroke={colors[seriesIndex % colors.length]}
                points={series.values
                  .map((value, index) => {
                    const x = plotLeft + index * slot + slot / 2;
                    const y = plotBottom - barHeight(value);
                    return `${x},${y}`;
                  })
                  .join(' ')}
                onMouseMove={(event) => showTip(event, series.name, series.name)}
                onMouseLeave={() => setTip(null)}
              />
            ) : (
              series.values.map((value, index) => (
                <rect
                  key={`${series.name}-${index}`}
                  x={plotLeft + index * slot + 2 + seriesIndex * barWidth}
                  y={plotBottom - barHeight(value)}
                  width={barWidth}
                  height={barHeight(value)}
                  fill={colors[seriesIndex % colors.length]}
                  onMouseEnter={(event) => showTip(event, series.name, `${model.xLabels[index] ?? ''}: ${value ?? 0}`)}
                  onMouseLeave={() => setTip(null)}
                />
              ))
            )}
          </g>
        ))}
        {model.xLabels.map((label, index) => {
          const x = plotLeft + index * slot + 2;
          const y = plotBottom + 14;
          return (
            <text key={label} x={x} y={y} fontSize="10" fill="#6d6d6d" transform={`rotate(60 ${x} ${y})`}>
              {label}
            </text>
          );
        })}
      </svg>
      {tip ? (
        <div className="crv2-tip" style={{ left: tip.x, top: tip.y }} role="tooltip">
          <strong>{tip.title}</strong>
          <span>{tip.body}</span>
        </div>
      ) : null}
      {model.caption ? <p role="status">{model.caption}</p> : null}
    </div>
  );
}

type TipEvent = { clientX: number; clientY: number };
type Slice = { name: string; value: number; index: number };

function slicesOf(model: ChartModel, hidden: string[]): Slice[] {
  if (model.series.length > 1) {
    return model.series.map((series, index) => ({
      name: series.name,
      index,
      value: hidden.includes(series.name) ? 0 : series.values.reduce((sum: number, value) => sum + (value ?? 0), 0),
    }));
  }
  const series = model.series[0];
  if (!series) return [];
  return model.xLabels.map((label, index) => ({
    name: label,
    index,
    value: hidden.includes(label) ? 0 : (series.values[index] ?? 0),
  }));
}

function ChartVariant({
  model,
  hidden,
  onToggle,
  onTip,
  onLeave,
  tip,
}: {
  model: ChartModel;
  hidden: string[];
  onToggle: (name: string) => void;
  onTip: (event: TipEvent, title: string, body: string) => void;
  onLeave: () => void;
  tip: { x: number; y: number; title: string; body: string } | null;
}) {
  const width = 640;
  const height = 280;
  const pie = model.mark === 'pie' || model.mark === 'donut';
  const slices = pie ? slicesOf(model, hidden) : [];
  const legend = pie ? slices : model.series.map((series, index) => ({ name: series.name, index, value: 0 }));
  const legendItems = legend.length > 8 ? legend.slice(0, 8) : legend;
  return (
    <div>
      <svg data-testid="chart" role="img" viewBox={`0 0 ${width} ${height}`} width="100%" height="280">
        {legendItems.map((item) => (
          <text
            key={item.name}
            x="8"
            y={16 + item.index * 16}
            fill={COLORS[item.index % COLORS.length]}
            opacity={hidden.includes(item.name) ? 0.35 : 1}
            style={{ cursor: 'pointer' }}
            onClick={() => onToggle(item.name)}
          >
            {item.name}
          </text>
        ))}
        {pie ? (
          <PiePaths slices={slices} donut={model.mark === 'donut'} onTip={onTip} onLeave={onLeave} />
        ) : (
          <Cartesian model={model} hidden={hidden} onTip={onTip} onLeave={onLeave} />
        )}
      </svg>
      {tip ? (
        <div className="crv2-tip" style={{ left: tip.x, top: tip.y }} role="tooltip">
          <strong>{tip.title}</strong>
          <span>{tip.body}</span>
        </div>
      ) : null}
      {model.caption ? <p role="status">{model.caption}</p> : null}
    </div>
  );
}

function PiePaths({
  slices,
  donut,
  onTip,
  onLeave,
}: {
  slices: Slice[];
  donut: boolean;
  onTip: (event: TipEvent, title: string, body: string) => void;
  onLeave: () => void;
}) {
  const sum = slices.reduce((total, slice) => total + slice.value, 0) || 1;
  let angle = -Math.PI / 2;
  const cx = 360;
  const cy = 168;
  const radius = 78;
  return (
    <g>
      {slices.map((slice) => {
        const sweep = (slice.value / sum) * Math.PI * 2;
        const start = angle;
        angle += sweep;
        if (sweep <= 0) return null;
        if (sweep >= Math.PI * 2 - 0.0001) {
          return (
            <circle
              key={slice.name}
              cx={cx}
              cy={cy}
              r={radius}
              fill={COLORS[slice.index % COLORS.length]}
              onMouseEnter={(event) => onTip(event, slice.name, slice.value.toLocaleString('en-US'))}
              onMouseLeave={onLeave}
            />
          );
        }
        const large = sweep > Math.PI ? 1 : 0;
        const x1 = cx + radius * Math.cos(start);
        const y1 = cy + radius * Math.sin(start);
        const x2 = cx + radius * Math.cos(start + sweep);
        const y2 = cy + radius * Math.sin(start + sweep);
        return (
          <path
            key={slice.name}
            d={`M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`}
            fill={COLORS[slice.index % COLORS.length]}
            onMouseEnter={(event) => onTip(event, slice.name, slice.value.toLocaleString('en-US'))}
            onMouseLeave={onLeave}
          />
        );
      })}
      {donut ? <circle cx={cx} cy={cy} r="42" fill="#fff" /> : null}
    </g>
  );
}

function Cartesian({
  model,
  hidden,
  onTip,
  onLeave,
}: {
  model: ChartModel;
  hidden: string[];
  onTip: (event: TipEvent, title: string, body: string) => void;
  onLeave: () => void;
}) {
  const mark = model.mark;
  const horizontal = mark.startsWith('bar');
  const stacked = mark.includes('stacked');
  const percent = mark.endsWith('100');
  const area = mark.startsWith('area');
  const bars = mark.startsWith('bar') || mark.startsWith('column');
  const markers = mark === 'line-markers' || mark === 'area-markers';
  const stepped = mark === 'line-stepped';
  const stackedArea = area && mark !== 'area' && mark !== 'area-markers';
  const plotLeft = horizontal ? 96 : 28;
  const plotRight = 620;
  const plotTop = 16 + Math.min(model.series.length, 8) * 16;
  const plotBottom = horizontal ? 260 : 200;
  const count = Math.max(1, model.xLabels.length);
  const slot = (horizontal ? plotBottom - plotTop : plotRight - plotLeft) / count;
  const visible = model.series.map((series, index) => ({ series, index })).filter((item) => !hidden.includes(item.series.name));
  const shareAt = (labelIndex: number, order: number) => {
    const raws = visible.map((item) => item.series.values[labelIndex] ?? 0);
    const total = raws.reduce((sum, value) => sum + value, 0) || 1;
    const raw = raws[order] ?? 0;
    return percent ? (raw / total) * 100 : raw;
  };
  const highAt = (labelIndex: number, order: number) => {
    let high = 0;
    for (let index = 0; index <= order; index += 1) high += shareAt(labelIndex, index);
    return high;
  };
  const max = percent
    ? 100
    : Math.max(
        1,
        ...model.xLabels.map((_, labelIndex) => {
          const values = visible.map((item) => item.series.values[labelIndex] ?? 0);
          return stacked || stackedArea ? values.reduce((sum, value) => sum + value, 0) : Math.max(0, ...values);
        }),
      );
  const depth = horizontal ? plotRight - plotLeft : plotBottom - plotTop;
  const scale = (value: number) => (value / max) * depth;
  const pointAt = (labelIndex: number, value: number) => {
    const along = (horizontal ? plotTop : plotLeft) + labelIndex * slot + slot / 2;
    const measured = scale(value);
    return horizontal ? { x: plotLeft + measured, y: along } : { x: along, y: plotBottom - measured };
  };
  return (
    <g>
      {model.xLabels.map((label, labelIndex) => {
        const origin = (horizontal ? plotTop : plotLeft) + labelIndex * slot;
        let stack = 0;
        return (
          <g key={`${label}-${labelIndex}`}>
            {bars
              ? visible.map((item, order) => {
                  const raw = item.series.values[labelIndex] ?? 0;
                  const share = shareAt(labelIndex, order);
                  const color = COLORS[item.index % COLORS.length];
                  const labelText = `${label}: ${raw.toLocaleString('en-US')}`;
                  if (horizontal) {
                    const band = Math.max(1, slot - 6);
                    const height = stacked ? band : band / Math.max(1, visible.length);
                    const y = stacked ? origin + 3 : origin + 3 + order * height;
                    const x = plotLeft + (stacked ? scale(stack) : 0);
                    if (stacked) stack += share;
                    return (
                      <rect
                        key={item.series.name}
                        x={x}
                        y={y}
                        width={Math.max(0, scale(share))}
                        height={Math.max(1, height)}
                        fill={color}
                        onMouseEnter={(event) => onTip(event, item.series.name, labelText)}
                        onMouseLeave={onLeave}
                      />
                    );
                  }
                  const clustered = !stacked;
                  const barWidth = clustered ? Math.max(1, (slot - 4) / Math.max(1, visible.length)) : Math.max(1, slot - 4);
                  const x = clustered ? origin + 2 + order * barWidth : origin + 2;
                  const y = plotBottom - scale(clustered ? share : stack + share);
                  if (!clustered) stack += share;
                  return (
                    <rect
                      key={item.series.name}
                      x={x}
                      y={y}
                      width={barWidth}
                      height={scale(share)}
                      fill={color}
                      onMouseEnter={(event) => onTip(event, item.series.name, labelText)}
                      onMouseLeave={onLeave}
                    />
                  );
                })
              : null}
            <text
              x={horizontal ? 4 : origin + 2}
              y={horizontal ? origin + slot / 2 : plotBottom + 14}
              fontSize="10"
              fill="#6d6d6d"
              transform={horizontal ? undefined : `rotate(60 ${origin + 2} ${plotBottom + 14})`}
            >
              {label}
            </text>
          </g>
        );
      })}
      {visible.map((item, order) => {
        const drawLine = mark.startsWith('line') || area || (mark === 'column-line' && order === visible.length - 1);
        if (!drawLine) return null;
        const color = COLORS[item.index % COLORS.length];
        const measured = (labelIndex: number) => (stacked || stackedArea ? highAt(labelIndex, order) : (item.series.values[labelIndex] ?? 0));
        const coords = model.xLabels.map((_, labelIndex) => pointAt(labelIndex, measured(labelIndex)));
        const lineCoords = stepped
          ? coords.flatMap((point, index) => (index === 0 ? [point] : [{ x: point.x, y: coords[index - 1]?.y ?? point.y }, point]))
          : coords;
        const poly = lineCoords.map((point) => `${point.x},${point.y}`).join(' ');
        let areaShape: string | null = null;
        if (area && coords.length > 0) {
          if (stackedArea) {
            const lower = model.xLabels.map((_, labelIndex) => pointAt(labelIndex, order === 0 ? 0 : highAt(labelIndex, order - 1)));
            areaShape = [...coords, ...[...lower].reverse()].map((point) => `${point.x},${point.y}`).join(' ');
          } else {
            const first = coords[0];
            const last = coords[coords.length - 1];
            if (first && last) areaShape = `${first.x},${plotBottom} ${poly} ${last.x},${plotBottom}`;
          }
        }
        return (
          <g key={item.series.name}>
            {areaShape ? <polygon points={areaShape} fill={color} opacity={stackedArea ? 0.85 : 0.35} /> : null}
            <polyline
              fill="none"
              stroke={color}
              strokeWidth="2"
              points={poly}
              onMouseMove={(event) => onTip(event, item.series.name, item.series.name)}
              onMouseLeave={onLeave}
            />
            {markers
              ? coords.map((point, index) => (
                  <circle
                    key={index}
                    cx={point.x}
                    cy={point.y}
                    r="3"
                    fill={color}
                    onMouseEnter={(event) => onTip(event, item.series.name, `${model.xLabels[index] ?? ''}: ${(item.series.values[index] ?? 0).toLocaleString('en-US')}`)}
                    onMouseLeave={onLeave}
                  />
                ))
              : null}
          </g>
        );
      })}
    </g>
  );
}
