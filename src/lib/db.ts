import { Pool } from 'pg';

// Database connection pool for server-side PostgreSQL / Supabase
const connectionString =
  process.env.DATABASE_URL ||
  'postgres://postgres:postgres@localhost:5432/syllabus_tracker';

let pool: Pool | null = null;

export function getDbPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' && !connectionString.includes('localhost')
        ? { rejectUnauthorized: false }
        : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle database client', err);
    });
  }
  return pool;
}

export async function query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number | null }> {
  const client = getDbPool();
  const start = Date.now();
  try {
    const res = await client.query(text, params);
    const duration = Date.now() - start;
    if (process.env.DEBUG_SQL === 'true') {
      console.log('Executed query', { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('Database query error:', { text, error });
    throw error;
  }
}

export async function withTransaction<T>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  const pool = getDbPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
