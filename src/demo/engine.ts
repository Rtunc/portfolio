import { createRequire } from 'node:module';
import { Worker as NodeWorker } from 'node:worker_threads';
import * as duckdb from '@duckdb/duckdb-wasm';
import type { CompiledQuery, QueryRow } from './types';

const require = createRequire(import.meta.url);

const CREATE_FEE_LINES = `
CREATE OR REPLACE TABLE fee_lines AS
SELECT
  CAST(learner_id AS VARCHAR) AS learner_id,
  CAST(learner AS VARCHAR) AS learner,
  CAST(site AS VARCHAR) AS site,
  CAST(room AS VARCHAR) AS room,
  CAST(programme AS VARCHAR) AS programme,
  CAST(fee_type AS VARCHAR) AS fee_type,
  CAST(status AS VARCHAR) AS status,
  CAST(fee_month AS DATE) AS fee_month,
  CAST(amount AS DOUBLE) AS amount
FROM read_csv_auto('fee_lines.csv', header = true)
`;

const REQUIRED_COLUMNS = [
  'learner_id',
  'learner',
  'site',
  'room',
  'programme',
  'fee_type',
  'status',
  'fee_month',
  'amount',
];

export class LoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LoadError';
  }
}

export type SqlExecutor = {
  registerCsv(fileName: string, csvText: string): Promise<void>;
  exec(sql: string): Promise<void>;
  query(sql: string, params: string[]): Promise<QueryRow[]>;
};

export function createQueue(executor: Pick<SqlExecutor, 'query'>) {
  let latest = 0;
  let gate: Promise<void> = Promise.resolve();
  let tail: Promise<unknown> = Promise.resolve();
  return {
    holdUntil(ready: Promise<void>) {
      gate = ready;
    },
    run(token: number, queries: CompiledQuery[]) {
      latest = token;
      const turn = tail.then(async () => {
        await gate;
        if (token !== latest) return null;
        const rows: QueryRow[][] = [];
        for (const query of queries) {
          if (token !== latest) return null;
          rows.push(await executor.query(query.sql, query.params));
        }
        return token === latest ? { token, rows } : null;
      });
      tail = turn.then(
        () => undefined,
        () => undefined,
      );
      return turn;
    },
  };
}

export function assertCsvHeader(csvText: string): void {
  const header = csvText.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] ?? '';
  const columns = new Set(header.split(',').map((column) => column.trim()));
  const missing = REQUIRED_COLUMNS.filter((name) => !columns.has(name));
  if (missing.includes('amount')) throw new LoadError('missing column: amount');
  if (missing.length > 0) throw new LoadError(`missing column: ${missing[0]}`);
}

export async function loadFeeLines(executor: SqlExecutor, csvText: string): Promise<void> {
  assertCsvHeader(csvText);
  try {
    await executor.registerCsv('fee_lines.csv', csvText);
    await executor.exec(CREATE_FEE_LINES);
  } catch (error) {
    if (error instanceof LoadError) throw error;
    throw new LoadError(error instanceof Error ? error.message : 'Could not load the fee CSV.');
  }
  const [types] = await executor.query(
    'SELECT MIN(typeof(fee_month)) AS month_type, MIN(typeof(amount)) AS amount_type FROM fee_lines',
    [],
  );
  const monthType = String(types?.month_type ?? '');
  const amountType = String(types?.amount_type ?? '');
  if (!monthType.includes('DATE') || amountType !== 'DOUBLE') {
    throw new LoadError(`unexpected types: ${monthType} ${amountType}`);
  }
}

export function normalizeCell(value: unknown): string | number | null {
  if (value == null) return null;
  if (value instanceof Date) {
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const day = String(value.getUTCDate()).padStart(2, '0');
    return `${value.getUTCFullYear()}-${month}-${day}`;
  }
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number' || typeof value === 'string') return value;
  return String(value);
}

export function rowsFromTable(table: {
  schema: { fields: { name: string }[] };
  batches: { numRows: number; getChildAt(index: number): { get(row: number): unknown } | null }[];
}): QueryRow[] {
  const names = table.schema.fields.map((field) => field.name);
  const rows: QueryRow[] = [];
  for (const batch of table.batches) {
    for (let rowIndex = 0; rowIndex < batch.numRows; rowIndex += 1) {
      const row: QueryRow = {};
      names.forEach((name, column) => {
        row[name] = normalizeCell(batch.getChildAt(column)?.get(rowIndex));
      });
      rows.push(row);
    }
  }
  return rows;
}

// The published worker assigns globalThis.onmessage. Node only delivers parentPort events.
function nodeWorker(workerPath: string): NodeWorker {
  return new NodeWorker(
    `
      const { parentPort } = require('node:worker_threads');
      const pending = [];
      let handler = null;
      Object.defineProperty(globalThis, 'onmessage', {
        configurable: true,
        get() { return handler; },
        set(next) {
          handler = next;
          while (pending.length > 0) handler({ data: pending.shift() });
        },
      });
      globalThis.postMessage = (data, transfer) => parentPort.postMessage(data, transfer);
      parentPort.on('message', (data) => {
        if (handler) handler({ data });
        else pending.push(data);
      });
      require(${JSON.stringify(workerPath)});
    `,
    { eval: true },
  );
}

// DuckDB calls addEventListener. The Node worker speaks parentPort events instead.
function duckDbWorker(worker: NodeWorker): Worker {
  type Handler = (event: { data?: unknown; message?: string }) => void;
  const listeners = new Map<string, Set<Handler>>();
  const addEventListener = (type: string, handler: Handler) => {
    const set = listeners.get(type) ?? new Set<Handler>();
    set.add(handler);
    listeners.set(type, set);
  };
  const removeEventListener = (type: string, handler: Handler) => {
    listeners.get(type)?.delete(handler);
  };
  const emit = (type: string, event: { data?: unknown; message?: string }) => {
    for (const handler of listeners.get(type) ?? []) handler(event);
  };
  worker.on('message', (data) => emit('message', { data }));
  worker.on('error', (error: Error) => emit('error', { message: error.message }));
  worker.on('exit', () => emit('close', {}));
  return {
    addEventListener,
    removeEventListener,
    postMessage: (message: unknown, transfer?: ArrayBuffer[]) => worker.postMessage(message, transfer),
    terminate: () => {
      void worker.terminate();
    },
  } as unknown as Worker;
}

export async function createNodeExecutor(): Promise<SqlExecutor> {
  const wasm = require.resolve('@duckdb/duckdb-wasm/dist/duckdb-eh.wasm');
  const workerPath = require.resolve('@duckdb/duckdb-wasm/dist/duckdb-node-eh.worker.cjs');
  const worker = nodeWorker(workerPath);
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), duckDbWorker(worker));
  await db.instantiate(wasm);
  worker.unref();
  const connection = await db.connect();
  return {
    async registerCsv(fileName, csvText) {
      await db.registerFileText(fileName, csvText);
    },
    async exec(sql) {
      await connection.query(sql);
    },
    async query(sql, params) {
      const statement = await connection.prepare(sql);
      try {
        const table = await statement.query(...params);
        return rowsFromTable(table);
      } finally {
        await statement.close();
      }
    },
  };
}
