import type { CompiledQuery, QueryRow } from './types';

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
    sample(sql: string, params: string[]) {
      const turn = tail.then(async () => {
        await gate;
        return executor.query(sql, params);
      });
      tail = turn.then(
        () => undefined,
        () => undefined,
      );
      return turn;
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

export const PREVIEW_COLUMNS = [
  { name: 'fee_month', label: 'Month', type: 'time' },
  { name: 'site', label: 'Site', type: 'string' },
  { name: 'room', label: 'Room', type: 'string' },
  { name: 'programme', label: 'Programme', type: 'string' },
  { name: 'fee_type', label: 'Fee type', type: 'string' },
  { name: 'status', label: 'Status', type: 'string' },
  { name: 'learner', label: 'Learner', type: 'string' },
] as const;

export const PREVIEW_ROW_CAP = 100;

export function previewSql(): string {
  const columns = PREVIEW_COLUMNS.map((column) => column.name).join(', ');
  return `SELECT ${columns} FROM fee_lines LIMIT ${PREVIEW_ROW_CAP}`;
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

function normalizeTemporal(value: number | bigint, typeText: string): string | null {
  const raw = typeof value === 'bigint' ? Number(value) : value;
  let milliseconds = raw;
  if (/nanosecond/i.test(typeText)) milliseconds = raw / 1_000_000;
  else if (/microsecond/i.test(typeText)) milliseconds = raw / 1000;
  else if (/date/i.test(typeText) && /day/i.test(typeText)) {
    // DuckDB-WASM reports Date32<DAY> and still returns epoch milliseconds.
    milliseconds = Math.abs(raw) > 1e8 ? raw : raw * 86_400_000;
  }
  else if (/second/i.test(typeText) && !/milli|micro|nano/i.test(typeText)) milliseconds = raw * 1000;
  const formatted = normalizeCell(new Date(milliseconds));
  return typeof formatted === 'string' ? formatted : null;
}

export function rowsFromTable(table: {
  schema: { fields: { name: string; type?: { toString(): string } }[] };
  batches: { numRows: number; getChildAt(index: number): { get(row: number): unknown } | null }[];
}): QueryRow[] {
  const fields = table.schema.fields;
  const rows: QueryRow[] = [];
  for (const batch of table.batches) {
    for (let rowIndex = 0; rowIndex < batch.numRows; rowIndex += 1) {
      const row: QueryRow = {};
      fields.forEach((field, column) => {
        const value = batch.getChildAt(column)?.get(rowIndex);
        const typeText = field.type?.toString() ?? '';
        if (/date|timestamp/i.test(typeText) && (typeof value === 'number' || typeof value === 'bigint')) {
          row[field.name] = normalizeTemporal(value, typeText);
          return;
        }
        row[field.name] = normalizeCell(value);
      });
      rows.push(row);
    }
  }
  return rows;
}
