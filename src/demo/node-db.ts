import { createRequire } from 'node:module';
import { Worker as NodeWorker } from 'node:worker_threads';
import * as duckdb from '@duckdb/duckdb-wasm';
import { rowsFromTable, type SqlExecutor } from './engine';

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
  const require = createRequire(import.meta.url);
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
