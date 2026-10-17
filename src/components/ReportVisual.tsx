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
                <th />
                {model.columnLabels.map((label) => (
                  <th key={label} scope="col">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {model.body.map((row, rowIndex) => (
                <tr key={model.rowLabels[rowIndex] ?? rowIndex}>
                  <th scope="row">{model.rowLabels[rowIndex] ?? ''}</th>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{cell.every((value) => value == null) ? '' : cell.join(' · ')}</td>
                  ))}
                </tr>
              ))}
              {model.columnTotals ? (
                <tr>
                  <th scope="row">Total</th>
                  {model.columnTotals.map((cell, index) => (
                    <td key={index}>{cell.join(' · ')}</td>
                  ))}
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
  const height = 240;
  const width = 640;
  const max = Math.max(1, ...model.series.flatMap((series) => series.values.map((value) => value ?? 0)));
  return (
    <div>
      <svg data-testid="chart" role="img" viewBox={`0 0 ${width} ${height}`} width="100%" height="240">
        {model.series.map((series, seriesIndex) => (
          <g key={series.name}>
            <text x="8" y={18 + seriesIndex * 16}>
              {series.name}
            </text>
            {model.mark === 'line' ? (
              <polyline
                fill="none"
                stroke="currentColor"
                points={series.values
                  .map((value, index) => {
                    const x = 120 + index * 28;
                    const y = height - 36 - ((value ?? 0) / max) * 160;
                    return `${x},${y}`;
                  })
                  .join(' ')}
              />
            ) : (
              series.values.map((value, index) => (
                <rect
                  key={`${series.name}-${index}`}
                  x={120 + index * 28 + seriesIndex * 6}
                  y={height - 36 - ((value ?? 0) / max) * 160}
                  width="8"
                  height={((value ?? 0) / max) * 160}
                />
              ))
            )}
          </g>
        ))}
        {model.xLabels.map((label, index) => (
          <text key={label} x={112 + index * 28} y={height - 12}>
            {label}
          </text>
        ))}
      </svg>
      {model.caption ? <p role="status">{model.caption}</p> : null}
    </div>
  );
}
