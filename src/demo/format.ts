import type { Agg } from './types';

export function formatMeasure(value: number, agg: Agg): string {
  if (agg === 'avg') {
    const rounded = Math.round(value * 100) / 100;
    const [whole, fraction] = rounded.toFixed(2).split('.');
    const grouped = Number(whole).toLocaleString('en-US');
    const trimmed = fraction.replace(/0+$/, '');
    return trimmed.length === 0 ? grouped : `${grouped}.${trimmed}`;
  }
  return Math.round(value).toLocaleString('en-US');
}
