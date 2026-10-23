import type { PoolClient } from 'pg';

/** Multi-row INSERT in chunks so large seeds stay well under Postgres' 65k-parameter limit. */
export async function bulkInsert(c: PoolClient, table: string, cols: string[], rows: unknown[][], chunk = 400) {
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    const params: unknown[] = [];
    const values = part.map((r) => `(${r.map((v) => { params.push(v); return `$${params.length}`; }).join(',')})`).join(',');
    await c.query(`insert into ${table} (${cols.join(',')}) values ${values}`, params);
  }
}
