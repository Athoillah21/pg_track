import { Pool } from 'pg';
import { cookies } from 'next/headers';
import { querySystem } from './system-db';
import { decrypt } from './crypto';

// Cache pools to avoid exhausting connections
// Key: connection_id
const poolCache = new Map<string, Pool>();

async function getActivePool(): Promise<Pool> {
  const cookieStore = await cookies();
  const activeId = cookieStore.get('pg_track_active_connection')?.value;
  const encryptedPassword = cookieStore.get('pg_track_db_credential')?.value;

  if (!activeId) {
    throw new Error("No active database connection selected.");
  }

  if (!encryptedPassword) {
    throw new Error("Database credentials not found. Please reconnect.");
  }

  if (poolCache.has(activeId)) {
    return poolCache.get(activeId)!;
  }

  // Fetch config from System DB (NOT the password - that's in the cookie)
  const res = await querySystem('SELECT host, port, username, database, ssl_mode FROM pg_track_connections WHERE id = $1', [activeId]);
  if (res.rowCount === 0) {
    throw new Error("Active connection configuration not found.");
  }
  const config = res.rows[0];

  // Decrypt password from cookie
  const password = decrypt(encryptedPassword);

  const newPool = new Pool({
    user: config.username,
    password: password,
    host: config.host,
    port: config.port,
    database: config.database,
    ssl: config.ssl_mode === 'require' ? { rejectUnauthorized: false } : undefined
  });

  poolCache.set(activeId, newPool);
  return newPool;
}

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const pool = await getActivePool();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    return res;
  } catch (error) {
    console.error('TARGET DATABASE ERROR:', error);
    throw error;
  }
};
