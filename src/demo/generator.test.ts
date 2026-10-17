/** @vitest-environment node */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildCsv } from '../../tools/make_demo_fees.mjs';

const MONTHS = new Set<string>();
for (let month = 1; month <= 12; month += 1) MONTHS.add(`2024-${String(month).padStart(2, '0')}-01`);
for (let month = 1; month <= 6; month += 1) MONTHS.add(`2025-${String(month).padStart(2, '0')}-01`);

describe('buildCsv', () => {
  const csv = buildCsv();
  const lines = csv.trimEnd().split('\n');

  it('freezes the header, the row count, and the three sample rows', () => {
    expect(lines[0]).toBe('learner_id,learner,site,room,programme,fee_type,status,fee_month,amount');
    expect(lines).toHaveLength(15553);
    expect(lines[1]).toBe('L0001,An Ash,Harbor,Maple,Weekday care,Tuition,Open,2024-01-01,900');
    expect(lines[2]).toBe('L0001,An Ash,Harbor,Maple,Weekday care,Meals,Open,2024-01-01,120');
    expect(lines[15552]).toBe('L0288,Bo Lane,Wharf,Alder,After school,Materials,Paid,2025-06-01,35');
  });

  it('keeps every amount finite, every learner id present, and every month inside the window', () => {
    for (const line of lines.slice(1)) {
      const [learnerId, , , , , , , feeMonth, amount] = line.split(',');
      expect(learnerId.length).toBeGreaterThan(0);
      expect(MONTHS.has(feeMonth)).toBe(true);
      expect(Number.isFinite(Number(amount))).toBe(true);
    }
  });

  it('matches the committed CSV', () => {
    const committed = readFileSync(new URL('../../public/demo/fee_lines.csv', import.meta.url), 'utf8');
    expect(committed).toBe(csv);
  });
});
