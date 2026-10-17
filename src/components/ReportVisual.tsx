import type { VisualModel } from '../demo/types';

export function ReportVisual({ model }: { model: VisualModel }) {
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
  const height = 280;
  const width = 640;
  const colors = ['#1f4e5f', '#c46b3a', '#2f6f4e', '#8c3d55', '#3d5a80', '#b08900', '#5c4d7a', '#3f6f8c'];
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
            <text x="8" y={16 + seriesIndex * 16} fill={colors[seriesIndex % colors.length]}>
              {series.name}
            </text>
            {model.mark === 'line' ? (
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
                />
              ))
            )}
          </g>
        ))}
        {model.xLabels.map((label, index) => {
          const x = plotLeft + index * slot + 2;
          const y = plotBottom + 14;
          return (
            <text key={label} x={x} y={y} fontSize="10" transform={`rotate(60 ${x} ${y})`}>
              {label}
            </text>
          );
        })}
      </svg>
      {model.caption ? <p role="status">{model.caption}</p> : null}
    </div>
  );
}
