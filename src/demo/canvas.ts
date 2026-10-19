import { preset, switchWidget } from './state';
import type { ChartMark, DemoState } from './types';

export const GRID_COLUMNS = 12;
export const ROW_HEIGHT = 80;
export const GRID_GUTTER = 16;
export const MIN_WIDGET_W = 2;
export const MIN_WIDGET_H = 2;
export const MAX_WIDGET_W = 12;
export const MAX_WIDGET_H = 8;

export type WidgetFamily = 'chart' | 'table' | 'pivot-table' | 'number-card' | 'slicer';

export type GridBox = { x: number; y: number; w: number; h: number; z: number };

export type CanvasWidget = {
  id: string;
  name: string;
  family: WidgetFamily;
  box: GridBox;
  state: DemoState;
  note: string | null;
};

type Placed = { id: string; family: WidgetFamily; box: GridBox };

const ROW_CAP: Record<WidgetFamily, number> = {
  chart: 3,
  'number-card': 4,
  slicer: 4,
  table: 1,
  'pivot-table': 1,
};

const ROW_H: Record<WidgetFamily, number> = {
  chart: 5,
  'number-card': 3,
  slicer: 3,
  table: 5,
  'pivot-table': 5,
};

const NAMES: Record<WidgetFamily, string> = {
  chart: 'Untitled chart',
  table: 'Untitled table',
  'pivot-table': 'Untitled pivot',
  'number-card': 'Number card',
  slicer: 'Slicer',
};

export function familyOfState(state: DemoState): WidgetFamily {
  if (state.widget === 'table') return 'table';
  if (state.widget === 'pivot') return 'pivot-table';
  return 'chart';
}

export function presetWidget(state: DemoState = preset()): CanvasWidget {
  return {
    id: 'fees',
    name: 'Fees by site and month',
    family: familyOfState(state),
    box: { x: 0, y: 0, w: GRID_COLUMNS, h: ROW_H.chart, z: 1 },
    state,
    note: null,
  };
}

export function createWidget(family: WidgetFamily, id: string, box: GridBox, mark?: ChartMark): CanvasWidget {
  let state = preset();
  if (family === 'table') state = switchWidget(preset(), 'table');
  else if (family === 'pivot-table') state = switchWidget(preset(), 'pivot');
  else state = { ...preset(), chartMark: mark ?? 'column' };
  const parked = family === 'number-card' || family === 'slicer';
  return { id, name: NAMES[family], family, box, state, note: parked ? NAMES[family] : null };
}

export function planAutoRow(items: readonly Placed[], family: WidgetFamily): {
  box: Omit<GridBox, 'z'>;
  siblings: Array<{ id: string; box: Omit<GridBox, 'z'> }>;
} {
  const cap = ROW_CAP[family];
  const height = ROW_H[family];
  const same = items.filter((item) => item.family === family);
  if (cap > 1 && same.length > 0) {
    const lastY = Math.max(...same.map((item) => item.box.y));
    const row = same.filter((item) => item.box.y === lastY).sort((left, right) => left.box.x - right.box.x);
    if (row.length < cap) {
      const width = Math.floor(GRID_COLUMNS / (row.length + 1));
      return {
        box: { x: row.length * width, y: lastY, w: width, h: height },
        siblings: row.map((member, index) => ({
          id: member.id,
          box: { x: index * width, y: lastY, w: width, h: height },
        })),
      };
    }
  }
  const y = items.length === 0 ? 0 : Math.max(...items.map((item) => item.box.y + item.box.h));
  return { box: { x: 0, y, w: GRID_COLUMNS, h: height }, siblings: [] };
}

export function insertBeside(anchor: GridBox): Omit<GridBox, 'z'> {
  const width = 6;
  const height = ROW_H.chart;
  if (anchor.x + anchor.w + width <= GRID_COLUMNS) {
    return { x: anchor.x + anchor.w, y: anchor.y, w: width, h: height };
  }
  return { x: anchor.x, y: anchor.y + anchor.h, w: width, h: height };
}

export function duplicateBelow(box: GridBox): Omit<GridBox, 'z'> {
  return { x: box.x, y: box.y + box.h, w: box.w, h: box.h };
}

export function topLayer(items: readonly { box: GridBox }[]): number {
  return items.reduce((max, item) => Math.max(max, item.box.z), 0);
}

export function clampMove(box: GridBox, dx: number, dy: number): GridBox {
  const x = Math.max(0, Math.min(GRID_COLUMNS - box.w, box.x + dx));
  const y = Math.max(0, box.y + dy);
  return { ...box, x, y };
}

export function clampResize(box: GridBox, dw: number, dh: number): GridBox {
  const w = Math.max(MIN_WIDGET_W, Math.min(MAX_WIDGET_W, GRID_COLUMNS - box.x, box.w + dw));
  const h = Math.max(MIN_WIDGET_H, Math.min(MAX_WIDGET_H, box.h + dh));
  return { ...box, w, h };
}

export function pitch(containerWidth: number): { x: number; y: number } {
  const width = containerWidth > 0 ? containerWidth : 720;
  const column = (width - GRID_GUTTER * (GRID_COLUMNS + 1)) / GRID_COLUMNS;
  return { x: column + GRID_GUTTER, y: ROW_HEIGHT + GRID_GUTTER };
}

export function cellDelta(containerWidth: number, dx: number, dy: number): { x: number; y: number } {
  const step = pitch(containerWidth);
  return { x: Math.round(dx / step.x), y: Math.round(dy / step.y) };
}

export function boxFrame(box: GridBox, containerWidth: number): { left: number; top: number; width: number; height: number } {
  const width = containerWidth > 0 ? containerWidth : 720;
  const column = (width - GRID_GUTTER * (GRID_COLUMNS + 1)) / GRID_COLUMNS;
  return {
    left: GRID_GUTTER + box.x * (column + GRID_GUTTER),
    top: GRID_GUTTER + box.y * (ROW_HEIGHT + GRID_GUTTER),
    width: box.w * column + Math.max(0, box.w - 1) * GRID_GUTTER,
    height: box.h * ROW_HEIGHT + Math.max(0, box.h - 1) * GRID_GUTTER,
  };
}

export function canvasHeight(boxes: readonly GridBox[]): number {
  if (boxes.length === 0) return 0;
  const bottom = Math.max(...boxes.map((box) => box.y + box.h));
  return GRID_GUTTER + bottom * (ROW_HEIGHT + GRID_GUTTER);
}
