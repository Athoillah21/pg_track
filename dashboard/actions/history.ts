'use server'

import { query } from '@/lib/db';

export type ChangeHistory = {
    id: string;
    schema_name: string;
    table_name: string;
    row_pk: any;
    version: number;
    operation: 'INSERT' | 'UPDATE' | 'DELETE';
    old_data: any;
    new_data: any;
    changed_columns: string[] | null;
    changed_at: Date;
    changed_by: string;
    txid: string;
    is_reverted: boolean;
};

export async function getRecentHistory(limit = 50): Promise<ChangeHistory[]> {
    const sql = `
    SELECT h.*,
        (
            SELECT ch.new_data 
            FROM pgtrack.change_history ch 
            WHERE ch.schema_name = h.schema_name 
              AND ch.table_name = h.table_name 
              AND ch.row_pk = h.row_pk 
            ORDER BY ch.version DESC 
            LIMIT 1
        ) IS NOT DISTINCT FROM h.old_data AS is_reverted
    FROM pgtrack.change_history h
    ORDER BY h.changed_at DESC 
    LIMIT $1
  `;
    const res = await query(sql, [limit]);
    return res.rows;
}

export async function getTableHistory(schema: string, table: string, limit = 50): Promise<ChangeHistory[]> {
    const sql = `
    SELECT h.*,
        (
            SELECT ch.new_data 
            FROM pgtrack.change_history ch 
            WHERE ch.schema_name = h.schema_name 
              AND ch.table_name = h.table_name 
              AND ch.row_pk = h.row_pk 
            ORDER BY ch.version DESC 
            LIMIT 1
        ) IS NOT DISTINCT FROM h.old_data AS is_reverted
    FROM pgtrack.change_history h
    WHERE h.schema_name = $1 AND h.table_name = $2
    ORDER BY h.changed_at DESC 
    LIMIT $3
  `;
    const res = await query(sql, [schema, table, limit]);
    return res.rows;
}

export async function getTrackedTables() {
    const sql = `
    SELECT schema_name, table_name, pk_columns, enabled 
    FROM pgtrack.tracked_tables
    ORDER BY schema_name, table_name
  `;
    const res = await query(sql);
    return res.rows;
}

export async function revertChange(schema: string, table: string, pk: any, version: number) {
    try {
        // We can call the SQL function directly
        // revert_to_version(schema, table, pk, version)
        // Note: revert_to_version reverts TO that version.
        // If we want to undo a specific change (e.g. change #5), we usually want to go back to state of #4.
        // But pgtrack.undo() is 'undo the LAST change'.

        // For specific history item revert, we might need pgtrack.revert()
        // Let's assume we want to revert TO the state of this version (restore it).

        const sql = `SELECT pgtrack.revert_to_version($1, $2, $3, $4)`;
        await query(sql, [schema, table, pk, version]);
        return { success: true };
    } catch (error: any) {
        console.error('Revert failed:', error);
        return { success: false, error: error.message };
    }
}
