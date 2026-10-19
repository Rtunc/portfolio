/** @vitest-environment node */

import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { compile } from './compile';
import {
  PREVIEW_COLUMNS,
  PREVIEW_ROW_CAP,
  assertCsvHeader,
  createQueue,
  loadFeeLines,
  LoadError,
  previewSql,
  rowsFromTable,
} from './engine';
import { createNodeExecutor } from './node-db';
import { preset } from './state';
import type { QueryRow } from './types';

const tiny = readFileSync(new URL('./fixtures/fees_tiny.csv', import.meta.url), 'utf8');

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('rowsFromTable', () => {
  it('turns a browser timestamp into a UTC date and leaves an amount numeric', () => {
    const rows = rowsFromTable({
      schema: {
        fields: [
          { name: 'fee_month', type: { toString: () => 'Timestamp(MILLISECOND)' } },
          { name: 'm_amount_sum' },
        ],
      },
      batches: [
        {
          numRows: 1,
          getChildAt(index: number) {
            return { get: () => (index === 0 ? 1704067200000 : 900) };
          },
        },
      ],
    });
    expect(rows).toEqual([{ fee_month: '2024-01-01', m_amount_sum: 900 }]);
  });

  it('reads DuckDB-WASM Date32 values that are epoch milliseconds', () => {
    const rows = rowsFromTable({
      schema: { fields: [{ name: 'fee_month', type: { toString: () => 'Date32<DAY>' } }] },
      batches: [{ numRows: 1, getChildAt: () => ({ get: () => 1704067200000 }) }],
    });
    expect(rows).toEqual([{ fee_month: '2024-01-01' }]);
  });

  it('reads an Arrow day count as a UTC date', () => {
    const rows = rowsFromTable({
      schema: { fields: [{ name: 'fee_month', type: { toString: () => 'Date32<DAY>' } }] },
      batches: [{ numRows: 1, getChildAt: () => ({ get: () => 19723 }) }],
    });
    expect(rows).toEqual([{ fee_month: '2024-01-01' }]);
  });
});

describe('queue', () => {
  it('drops a late token and does not start it after a newer token won', async () => {
    const first = deferred<QueryRow[]>();
    const query = vi.fn(async (sql: string) => (sql === 'a' ? first.promise : [{ m_amount_sum: 2 }]));
    const queue = createQueue({ query });
    const tokenA = queue.run(1, [{ purpose: 'grid', sql: 'a', params: [] }]);
    const tokenB = queue.run(2, [{ purpose: 'grid', sql: 'b', params: [] }]);
    first.resolve([{ m_amount_sum: 1 }]);
    await expect(tokenA).resolves.toBeNull();
    await expect(tokenB).resolves.toEqual({ token: 2, rows: [[{ m_amount_sum: 2 }]] });
  });

  it('waits for the load and runs only the latest token', async () => {
    const ready = deferred<void>();
    const query = vi.fn(async () => [{ m_amount_sum: 5 }]);
    const queue = createQueue({ query });
    queue.holdUntil(ready.promise);
    const first = queue.run(1, [{ purpose: 'grid', sql: 'old', params: [] }]);
    const second = queue.run(2, [{ purpose: 'grid', sql: 'new', params: [] }]);
    expect(query).not.toHaveBeenCalled();
    ready.resolve();
    await expect(first).resolves.toBeNull();
    await expect(second).resolves.toMatchObject({ token: 2 });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith('new', []);
  });
});

describe('previewFeeLines', () => {
  it('samples the detail columns and caps the row count', () => {
    const sql = previewSql();
    for (const column of PREVIEW_COLUMNS) expect(sql).toContain(column.name);
    expect(sql).not.toContain('amount');
    expect(sql).toContain(`LIMIT ${PREVIEW_ROW_CAP}`);
  });

  it('runs a sample without dropping the chart query already in the queue', async () => {
    const query = vi.fn(async (sql: string) => [{ fee_month: sql }]);
    const queue = createQueue({ query });
    const chart = queue.run(1, [{ purpose: 'grid', sql: 'chart', params: [] }]);
    const sample = queue.sample(previewSql(), []);
    await expect(chart).resolves.toMatchObject({ token: 1 });
    const rows = await sample;
    expect(rows).toHaveLength(1);
    expect(query).toHaveBeenCalledWith(previewSql(), []);
  });
});

describe('loadFeeLines', () => {
  it('rejects a CSV missing amount before DuckDB opens', () => {
    expect(() => assertCsvHeader('learner_id,learner\nL0001,An Ash\n')).toThrow(LoadError);
    expect(() => assertCsvHeader('learner_id,learner\nL0001,An Ash\n')).toThrow('missing column: amount');
  });

  it('sums Harbor in January and includes the February boundary', async () => {
    const executor = await createNodeExecutor();
    await loadFeeLines(executor, tiny);
    const january = compile({
      ...preset(),
      widget: 'table',
      tableColumns: ['amount', 'learners', 'fees'],
      chartX: null,
      chartSeries: null,
      chartY: [],
      filters: [
        { field: 'fee_month', operator: 'inDateRange', values: ['2024-01', '2024-01'] },
        { field: 'site', operator: 'in', values: ['Harbor'] },
      ],
    });
    if (!january.ok) throw new Error(january.reason);
    const [jan] = await executor.query(january.queries[0].sql, january.queries[0].params);
    expect(jan).toMatchObject({ m_amount_sum: 170, m_learners_count_distinct: 2, m_fees_count: 3 });

    const named = compile({
      ...preset(),
      widget: 'table',
      tableColumns: ['amount'],
      chartX: null,
      chartSeries: null,
      chartY: [],
      filters: [
        { field: 'fee_month', operator: 'inDateRange', values: ['2024-01', '2024-01'] },
        { field: 'site', operator: 'contains', values: ['Harbor'] },
      ],
    });
    if (!named.ok) throw new Error(named.reason);
    const [byName] = await executor.query(named.queries[0].sql, named.queries[0].params);
    expect(byName.m_amount_sum).toBe(170);

    const february = compile({
      ...preset(),
      widget: 'table',
      tableColumns: ['amount'],
      chartX: null,
      chartSeries: null,
      chartY: [],
      filters: [{ field: 'fee_month', operator: 'inDateRange', values: ['2024-02', '2024-02'] }],
    });
    if (!february.ok) throw new Error(february.reason);
    const [feb] = await executor.query(february.queries[0].sql, february.queries[0].params);
    expect(feb.m_amount_sum).toBe(220);
  }, 30_000);
});
