import { neon } from '@neondatabase/serverless';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
type Row = Record<string, unknown>;
const schema = [
  'CREATE TABLE IF NOT EXISTS links (slug TEXT PRIMARY KEY, destination TEXT NOT NULL, title TEXT NOT NULL, created_at DOUBLE PRECISION NOT NULL, clicks INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1)',
  'CREATE INDEX IF NOT EXISTS links_created_at ON links(created_at)',
  'CREATE TABLE IF NOT EXISTS login_attempts (bucket TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at DOUBLE PRECISION NOT NULL)'
];
let ready: Promise<void> | undefined;
let localDb: import('node:sqlite').DatabaseSync | undefined;
export const localMode = () => !process.env.VERCEL && process.env.SHORTLY_LOCAL === '1';
async function execute(sql: string, params: (string | number)[] = []) {
  if (localMode()) {
    if (!localDb) { const { DatabaseSync } = await import('node:sqlite'); mkdirSync(join(process.cwd(), '.data'), { recursive: true }); localDb = new DatabaseSync(join(process.cwd(), '.data/shortly.sqlite')); localDb.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;'); }
    const stmt = localDb.prepare(sql);
    if (/^(SELECT|WITH)/i.test(sql) || /RETURNING/i.test(sql)) { const rows = stmt.all(...params) as Row[]; return { rows, changes: rows.length }; }
    return { rows: [] as Row[], changes: Number(stmt.run(...params).changes) };
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not configured');
  let index = 0;
  const query = sql.replace(/\?/g, () => '$' + (++index));
  const result = await neon(url).query(query, params, { fullResults: true });
  return { rows: result.rows as Row[], changes: result.rowCount ?? 0 };
}
async function initialize() { for (const statement of schema) await execute(statement); }
async function run(sql: string, params: (string | number)[]) {
  ready ??= initialize().catch(error => { ready = undefined; throw error; });
  await ready; return execute(sql, params);
}
export function database() {
  return { prepare(sql: string) {
    let params: (string | number)[] = [];
    const stmt = {
      bind(...values: (string | number)[]) { params = values; return stmt; },
      async all() { return { results: (await run(sql, params)).rows }; },
      async first<T = Row>() { return ((await run(sql, params)).rows[0] as T) ?? null; },
      async run() { return { meta: { changes: (await run(sql, params)).changes } }; }
    }; return stmt;
  }};
}
