import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ChartModel, PivotModel } from '../demo/types';
import { ReportVisual } from './ReportVisual';

const rowsOnly: PivotModel = {
  kind: 'pivot',
  rowLabels: ['Harbor', 'Mill'],
  columnLabels: [],
  measureLabels: ['Amount', 'Learners'],
  body: [
    [['10', '2']],
    [['30', '2']],
  ],
  rowTotals: null,
  columnTotals: null,
  grand: ['100', '3'],
  caption: null,
  totalsNote: 'Totals cover every fee in this filter.',
  singleCell: false,
};

describe('ReportVisual', () => {
  it('prints the grand average and distinct count instead of the visible cells', () => {
    render(<ReportVisual model={rowsOnly} />);
    const total = screen.getByRole('row', { name: /Total/ });
    expect(total).toHaveTextContent('100');
    expect(total).toHaveTextContent('3');
    expect(total).not.toHaveTextContent('40');
  });

  it('paints row totals as a column and the grand total in the corner', () => {
    const model: PivotModel = {
      ...rowsOnly,
      columnLabels: ['Tuition'],
      measureLabels: ['Learners'],
      body: [[['2']], [['4']]],
      rowTotals: [['3'], ['6']],
      columnTotals: [['9']],
      grand: ['5'],
    };
    render(<ReportVisual model={model} />);
    expect(screen.getByRole('columnheader', { name: 'Total' })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /^Harbor/ })).toHaveTextContent('3');
    expect(screen.getByRole('row', { name: /^Total/ })).toHaveTextContent('5');
  });

  it('colors each series and keeps a month’s bars inside its slot', () => {
    const names = ['Harbor', 'Mill', 'Orchard', 'Ridge', 'Station', 'Wharf'];
    const model: ChartModel = {
      kind: 'chart',
      mark: 'column',
      xLabels: ['2024-01', '2024-02'],
      series: names.map((name, index) => ({ name, values: [index + 1, index + 2] })),
      caption: null,
    };
    const { container } = render(<ReportVisual model={model} />);
    const rects = Array.from(container.querySelectorAll('rect')).map((rect) => ({
      x: Number(rect.getAttribute('x')),
      width: Number(rect.getAttribute('width')),
      fill: rect.getAttribute('fill'),
    }));
    expect(new Set(rects.map((rect) => rect.fill)).size).toBe(names.length);
    const sorted = [...rects].sort((left, right) => left.x - right.x);
    const groups: { start: number; end: number }[] = [];
    for (const rect of sorted) {
      const end = rect.x + rect.width;
      const current = groups.at(-1);
      if (!current || rect.x > current.end + 1) groups.push({ start: rect.x, end });
      else current.end = Math.max(current.end, end);
    }
    expect(groups).toHaveLength(2);
    expect(groups[0].end).toBeLessThanOrEqual(groups[1].start);
    expect(container.querySelector('text[transform*="rotate"]')).not.toBeNull();
  });
});
