
const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

if (!process.env.SYSTEM_DB_URL) {
    console.error('SYSTEM_DB_URL is not defined in .env');
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.SYSTEM_DB_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const createTableSQL = `
  CREATE TABLE IF NOT EXISTS pg_track_connections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER DEFAULT 5432,
      username TEXT NOT NULL,
      password_hash TEXT, 
      database TEXT NOT NULL,
      ssl_mode TEXT DEFAULT 'disable',
      created_at TIMESTAMPTZ DEFAULT now()
  );
`;

async function main() {
    try {
        console.log('Connecting to System DB...');
        await pool.query('SELECT 1'); // Test connection with simple query
        console.log('Connected.');

        console.log('Creating pg_track_connections table...');
        await pool.query(createTableSQL);
        console.log('Table created successfully.');
    } catch (err) {
        console.error('Error initializing System DB:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
