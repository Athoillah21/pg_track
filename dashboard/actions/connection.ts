'use server'

import { querySystem } from "@/lib/system-db";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { hashPassword, verifyPassword, encrypt } from "@/lib/crypto";
import { Pool } from 'pg';

export type ConnectionConfig = {
    id: string;
    name: string;
    host: string;
    port: number;
    username: string;
    database: string;
    ssl_mode: string;
    created_at: Date;
};

export async function getConnections(): Promise<ConnectionConfig[]> {
    const sql = `SELECT id, name, host, port, username, database, ssl_mode, created_at FROM pg_track_connections ORDER BY created_at DESC`;
    const res = await querySystem(sql);
    return res.rows;
}

export async function saveConnection(data: Omit<ConnectionConfig, 'id' | 'created_at'> & { password?: string }) {
    const sql = `
        INSERT INTO pg_track_connections (name, host, port, username, password_hash, database, ssl_mode)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
    `;

    // Hash the password before storing
    const passwordHash = data.password ? hashPassword(data.password) : null;

    try {
        await querySystem(sql, [
            data.name,
            data.host,
            data.port || 5432,
            data.username,
            passwordHash,
            data.database,
            data.ssl_mode || 'disable'
        ]);
        revalidatePath('/connect');
        return { success: true };
    } catch (error: any) {
        console.error('Failed to save connection:', error);
        return { success: false, error: error.message };
    }
}

export async function deleteConnection(id: string) {
    try {
        await querySystem('DELETE FROM pg_track_connections WHERE id = $1', [id]);
        revalidatePath('/connect');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Test a database connection with given credentials
 */
async function testDatabaseConnection(config: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    ssl_mode: string;
}): Promise<{ success: boolean; error?: string }> {
    const pool = new Pool({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        ssl: config.ssl_mode === 'require' ? { rejectUnauthorized: false } : undefined,
        connectionTimeoutMillis: 10000, // 10 second timeout
    });

    try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        await pool.end();
        return { success: true };
    } catch (error: any) {
        await pool.end().catch(() => { });

        // Parse common PostgreSQL errors for user-friendly messages
        let errorMessage = error.message;

        if (error.code === 'ECONNREFUSED') {
            errorMessage = `Cannot connect to ${config.host}:${config.port}. Server may be down or unreachable.`;
        } else if (error.code === 'ENOTFOUND') {
            errorMessage = `Host "${config.host}" not found. Check the hostname.`;
        } else if (error.code === 'ETIMEDOUT') {
            errorMessage = `Connection timed out. Server may be blocked by firewall.`;
        } else if (error.code === '28P01' || error.message.includes('password authentication failed')) {
            errorMessage = `Authentication failed. Incorrect password.`;
        } else if (error.code === '28000') {
            errorMessage = `Authentication failed. User "${config.user}" is not authorized.`;
        } else if (error.code === '3D000') {
            errorMessage = `Database "${config.database}" does not exist.`;
        } else if (error.message.includes('SSL')) {
            errorMessage = `SSL connection error. Try changing SSL mode.`;
        }

        return { success: false, error: errorMessage };
    }
}

export async function setActiveConnection(id: string, password: string) {
    try {
        // Fetch connection config and verify password
        const res = await querySystem(
            'SELECT host, port, username, database, ssl_mode, password_hash FROM pg_track_connections WHERE id = $1',
            [id]
        );
        if (res.rowCount === 0) {
            return { success: false, error: 'Connection not found' };
        }

        const config = res.rows[0];
        const { password_hash } = config;

        // Verify password against stored hash
        if (!verifyPassword(password, password_hash)) {
            return { success: false, error: 'Invalid password. The password does not match the saved connection.' };
        }

        // Test actual database connectivity BEFORE setting cookies
        const testResult = await testDatabaseConnection({
            host: config.host,
            port: config.port,
            user: config.username,
            password: password,
            database: config.database,
            ssl_mode: config.ssl_mode,
        });

        if (!testResult.success) {
            return { success: false, error: testResult.error };
        }

        // Encrypt the plain password for session storage
        const encryptedPassword = encrypt(password);

        const cookieStore = await cookies();

        // Store connection ID
        cookieStore.set('pg_track_active_connection', id, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        });

        // Store encrypted password
        cookieStore.set('pg_track_db_credential', encryptedPassword, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        });

        return { success: true };
    } catch (error: any) {
        console.error('Failed to set active connection:', error);
        return { success: false, error: error.message };
    }
}

export async function clearActiveConnection() {
    const cookieStore = await cookies();
    cookieStore.delete('pg_track_active_connection');
    cookieStore.delete('pg_track_db_credential');
    return { success: true };
}
