import { describe, expect, it } from 'vitest';
import { presetWidget } from './canvas';
import {
  canvasHeight,
  cellDelta,
  clampMove,
  clampResize,
  createWidget,
  duplicateBelow,
  insertBeside,
  planAutoRow,
  topLayer,
} from './canvas';

describe('planAutoRow', () => {
  it('gives the first widget the full row and splits the next chart into that row', () => {
    const first = presetWidget();
    expect(first.box).toMatchObject({ x: 0, y: 0, w: 12, h: 5 });
    const second = planAutoRow([first], 'chart');
    expect(second.box).toMatchObject({ x: 6, y: 0, w: 6, h: 5 });
    expect(second.siblings).toEqual([{ id: 'fees', box: { x: 0, y: 0, w: 6, h: 5 } }]);
  });

  it('starts a new row when the chart row is full, and keeps a table on its own row', () => {
    const row = [0, 1, 2].map((index) => createWidget('chart', `c${index}`, { x: index * 4, y: 0, w: 4, h: 5, z: 1 }));
    const next = planAutoRow(row, 'chart');
    expect(next.box).toMatchObject({ x: 0, y: 5, w: 12 });
    expect(next.siblings).toEqual([]);
    const table = planAutoRow([presetWidget()], 'table');
    expect(table.box).toMatchObject({ x: 0, y: 5, w: 12, h: 5 });
  });
});

describe('move and resize', () => {
  const box = { x: 6, y: 0, w: 6, h: 5, z: 1 };

  it('places an insert beside a narrow widget and under a full one', () => {
    expect(insertBeside(box)).toMatchObject({ x: 6, y: 5, w: 6 });
    expect(insertBeside({ x: 0, y: 0, w: 4, h: 5, z: 1 })).toMatchObject({ x: 4, y: 0, w: 6 });
    expect(duplicateBelow(box)).toEqual({ x: 6, y: 5, w: 6, h: 5 });
  });

  it('clamps a drag to the grid and a resize to the column edge', () => {
    expect(clampMove(box, -10, 2)).toMatchObject({ x: 0, y: 2, w: 6 });
    expect(clampMove({ ...box, x: 0, w: 12 }, 3, 0)).toMatchObject({ x: 0, w: 12 });
    expect(clampResize(box, 20, -10)).toMatchObject({ w: 6, h: 2 });
    expect(clampResize({ x: 0, y: 0, w: 4, h: 5, z: 1 }, 2, 1)).toMatchObject({ w: 6, h: 6 });
    expect(cellDelta(0, 120, 200)).toEqual({ x: 2, y: 2 });
    expect(topLayer([{ box }, { box: { ...box, z: 4 } }])).toBe(4);
    expect(canvasHeight([box])).toBeGreaterThan(0);
  });
});
