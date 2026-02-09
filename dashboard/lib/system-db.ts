
import { Pool } from 'pg';

if (!process.env.SYSTEM_DB_URL) {
    throw new Error('SYSTEM_DB_URL environment variable is not defined');
}

const systemPool = new Pool({
    connectionString: process.env.SYSTEM_DB_URL,
    ssl: {
        rejectUnauthorized: false // Neon requires SSL
    }
});

export const querySystem = async (text: string, params?: any[]) => {
    const start = Date.now();
    try {
        const res = await systemPool.query(text, params);
        const duration = Date.now() - start;
        // console.log('executed system query', { text, duration, rows: res.rowCount });
        return res;
    } catch (error) {
        console.error('SYSTEM DATABASE ERROR:', error);
        throw error;
    }
};

export default systemPool;
