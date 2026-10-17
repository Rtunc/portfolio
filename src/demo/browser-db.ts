import * as duckdb from '@duckdb/duckdb-wasm';
import ehWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
import ehWasm from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import mvpWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import mvpWasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import { rowsFromTable, type SqlExecutor } from './engine';

const BUNDLES: duckdb.DuckDBBundles = {
  mvp: { mainModule: mvpWasm, mainWorker: mvpWorker },
  eh: { mainModule: ehWasm, mainWorker: ehWorker },
};

export async function openBrowserExecutor(): Promise<SqlExecutor> {
  const bundle = await duckdb.selectBundle(BUNDLES);
  const worker = new Worker(bundle.mainWorker!);
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
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
      const table = await statement.query(...params);
      const rows = rowsFromTable(table);
      await statement.close();
      return rows;
    },
  };
}
