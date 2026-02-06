-- pg_track--1.0.sql
-- Extension: pg_track
-- Schema: pgtrack

-- ============================================================================
-- SCHEMA AND TABLES
-- ============================================================================

-- Schema pgtrack is created by the extension manager

-- Configuration: which schemas are being tracked
CREATE TABLE IF NOT EXISTS pgtrack.tracked_schemas (
    schema_name     TEXT PRIMARY KEY,
    enabled         BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now(),
    created_by      TEXT DEFAULT current_user
);

-- Registry of all tracked tables
CREATE TABLE IF NOT EXISTS pgtrack.tracked_tables (
    id              SERIAL PRIMARY KEY,
    schema_name     TEXT NOT NULL,
    table_name      TEXT NOT NULL,
    pk_columns      TEXT[] NOT NULL,
    enabled         BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(schema_name, table_name)
);

-- Main change history table
CREATE TABLE IF NOT EXISTS pgtrack.change_history (
    id              BIGSERIAL PRIMARY KEY,
    schema_name     TEXT NOT NULL,
    table_name      TEXT NOT NULL,
    row_pk          JSONB NOT NULL,
    version         INTEGER NOT NULL,
    operation       TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data        JSONB,
    new_data        JSONB,
    changed_columns TEXT[],
    changed_at      TIMESTAMPTZ DEFAULT now(),
    changed_by      TEXT DEFAULT current_user,
    txid            BIGINT DEFAULT txid_current(),
    application     TEXT DEFAULT current_setting('application_name', true),
    client_ip       INET DEFAULT inet_client_addr(),
    session_user_   TEXT DEFAULT session_user
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_history_table ON pgtrack.change_history (schema_name, table_name);
CREATE INDEX IF NOT EXISTS idx_history_pk ON pgtrack.change_history (schema_name, table_name, row_pk);
CREATE INDEX IF NOT EXISTS idx_history_time ON pgtrack.change_history (changed_at);
CREATE INDEX IF NOT EXISTS idx_history_txid ON pgtrack.change_history (txid);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION pgtrack._get_pk_columns(p_schema TEXT, p_table TEXT)
RETURNS TEXT[] AS $$
DECLARE v_pk_columns TEXT[];
BEGIN
    SELECT array_agg(a.attname ORDER BY array_position(i.indkey, a.attnum))
    INTO v_pk_columns
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(i.indkey)
    WHERE n.nspname = p_schema AND c.relname = p_table AND i.indisprimary;
    IF v_pk_columns IS NULL THEN RAISE EXCEPTION 'Table %.% has no primary key', p_schema, p_table; END IF;
    RETURN v_pk_columns;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pgtrack._build_pk_jsonb(p_data JSONB, p_pk_columns TEXT[])
RETURNS JSONB AS $$
DECLARE v_result JSONB := '{}'; v_col TEXT;
BEGIN
    FOREACH v_col IN ARRAY p_pk_columns LOOP
        v_result := v_result || jsonb_build_object(v_col, p_data->v_col);
    END LOOP;
    RETURN v_result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION pgtrack._next_version(p_schema TEXT, p_table TEXT, p_pk JSONB)
RETURNS INTEGER AS $$
BEGIN
    RETURN COALESCE((SELECT MAX(version) FROM pgtrack.change_history 
                     WHERE schema_name = p_schema AND table_name = p_table AND row_pk = p_pk), 0) + 1;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pgtrack._find_changed_columns(p_old JSONB, p_new JSONB)
RETURNS TEXT[] AS $$
DECLARE v_changed TEXT[] := '{}'; v_key TEXT;
BEGIN
    FOR v_key IN SELECT jsonb_object_keys(p_new) LOOP
        IF p_old->v_key IS DISTINCT FROM p_new->v_key THEN v_changed := array_append(v_changed, v_key); END IF;
    END LOOP;
    RETURN v_changed;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Version function (uses C extension)
CREATE OR REPLACE FUNCTION pgtrack.version() RETURNS TEXT
AS 'MODULE_PATHNAME', 'pg_track_version'
LANGUAGE C STRICT IMMUTABLE;

-- ============================================================================
-- MAIN TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION pgtrack.track_changes() RETURNS TRIGGER AS $$
DECLARE
    v_pk_columns TEXT[]; v_old_data JSONB; v_new_data JSONB;
    v_pk_jsonb JSONB; v_version INTEGER; v_changed_columns TEXT[];
BEGIN
    SELECT pk_columns INTO v_pk_columns FROM pgtrack.tracked_tables
    WHERE schema_name = TG_TABLE_SCHEMA AND table_name = TG_TABLE_NAME AND enabled = true;
    
    IF v_pk_columns IS NULL THEN
        IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;
    
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        v_old_data := to_jsonb(OLD);
        v_pk_jsonb := pgtrack._build_pk_jsonb(v_old_data, v_pk_columns);
    END IF;
    
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        v_new_data := to_jsonb(NEW);
        IF v_pk_jsonb IS NULL THEN v_pk_jsonb := pgtrack._build_pk_jsonb(v_new_data, v_pk_columns); END IF;
    END IF;
    
    IF TG_OP = 'UPDATE' THEN
        v_changed_columns := pgtrack._find_changed_columns(v_old_data, v_new_data);
        IF array_length(v_changed_columns, 1) IS NULL THEN RETURN NEW; END IF;
    END IF;
    
    v_version := pgtrack._next_version(TG_TABLE_SCHEMA, TG_TABLE_NAME, v_pk_jsonb);
    
    INSERT INTO pgtrack.change_history (schema_name, table_name, row_pk, version, operation, old_data, new_data, changed_columns)
    VALUES (TG_TABLE_SCHEMA, TG_TABLE_NAME, v_pk_jsonb, v_version, TG_OP, v_old_data, v_new_data, v_changed_columns);
    
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER MANAGEMENT
-- ============================================================================

CREATE OR REPLACE FUNCTION pgtrack._create_table_trigger(p_schema TEXT, p_table TEXT)
RETURNS BOOLEAN AS $$
DECLARE v_pk_columns TEXT[]; v_trigger_name TEXT;
BEGIN
    v_pk_columns := pgtrack._get_pk_columns(p_schema, p_table);
    INSERT INTO pgtrack.tracked_tables (schema_name, table_name, pk_columns) VALUES (p_schema, p_table, v_pk_columns)
    ON CONFLICT (schema_name, table_name) DO UPDATE SET pk_columns = EXCLUDED.pk_columns, enabled = true;
    v_trigger_name := 'pgtrack_' || p_table || '_trigger';
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I', v_trigger_name, p_schema, p_table);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %I.%I FOR EACH ROW EXECUTE FUNCTION pgtrack.track_changes()', v_trigger_name, p_schema, p_table);
    RETURN true;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pgtrack._drop_table_trigger(p_schema TEXT, p_table TEXT)
RETURNS BOOLEAN AS $$
DECLARE v_trigger_name TEXT;
BEGIN
    v_trigger_name := 'pgtrack_' || p_table || '_trigger';
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I', v_trigger_name, p_schema, p_table);
    UPDATE pgtrack.tracked_tables SET enabled = false WHERE schema_name = p_schema AND table_name = p_table;
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SCHEMA TRACKING
-- ============================================================================

CREATE OR REPLACE FUNCTION pgtrack.enable_tracking(p_schema TEXT)
RETURNS TABLE(table_name TEXT, status TEXT) AS $$
DECLARE v_table RECORD; v_status TEXT;
BEGIN
    INSERT INTO pgtrack.tracked_schemas (schema_name) VALUES (p_schema)
    ON CONFLICT (schema_name) DO UPDATE SET enabled = true;
    
    FOR v_table IN SELECT c.relname AS tbl FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                   WHERE n.nspname = p_schema AND c.relkind = 'r' AND c.relname NOT LIKE 'pg_%' LOOP
        BEGIN
            PERFORM pgtrack._create_table_trigger(p_schema, v_table.tbl);
            v_status := 'tracking enabled';
        EXCEPTION WHEN OTHERS THEN v_status := 'error: ' || SQLERRM;
        END;
        table_name := v_table.tbl; status := v_status; RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pgtrack.disable_tracking(p_schema TEXT)
RETURNS TABLE(table_name TEXT, status TEXT) AS $$
DECLARE v_table RECORD;
BEGIN
    UPDATE pgtrack.tracked_schemas SET enabled = false WHERE schema_name = p_schema;
    FOR v_table IN SELECT tt.table_name AS tbl FROM pgtrack.tracked_tables tt WHERE tt.schema_name = p_schema LOOP
        PERFORM pgtrack._drop_table_trigger(p_schema, v_table.tbl);
        table_name := v_table.tbl; status := 'tracking disabled'; RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- REVERT FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION pgtrack.revert_to_version(p_schema TEXT, p_table TEXT, p_row_pk JSONB, p_version INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    v_history RECORD; v_data JSONB; v_current_exists BOOLEAN;
    v_cols TEXT; v_vals TEXT; v_updates TEXT; v_pk_where TEXT; v_col TEXT; v_val TEXT;
BEGIN
    SELECT * INTO v_history FROM pgtrack.change_history
    WHERE schema_name = p_schema AND table_name = p_table AND row_pk = p_row_pk AND version = p_version;
    IF NOT FOUND THEN RAISE EXCEPTION 'Version % not found for row %', p_version, p_row_pk; END IF;
    
    IF v_history.operation = 'DELETE' THEN v_data := v_history.old_data;
    ELSIF v_history.operation = 'INSERT' THEN v_data := v_history.new_data;
    ELSE v_data := v_history.old_data; END IF;
    
    IF v_data IS NULL THEN RAISE EXCEPTION 'No data available for version %', p_version; END IF;
    
    v_pk_where := '';
    FOR v_col IN SELECT jsonb_object_keys(p_row_pk) LOOP
        IF v_pk_where <> '' THEN v_pk_where := v_pk_where || ' AND '; END IF;
        v_pk_where := v_pk_where || format('%I = %L', v_col, p_row_pk->>v_col);
    END LOOP;
    
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.%I WHERE %s)', p_schema, p_table, v_pk_where) INTO v_current_exists;
    
    IF v_current_exists THEN
        v_updates := '';
        FOR v_col IN SELECT jsonb_object_keys(v_data) LOOP
            IF NOT (p_row_pk ? v_col) THEN
                IF v_updates <> '' THEN v_updates := v_updates || ', '; END IF;
                v_val := v_data->>v_col;
                IF v_val IS NULL THEN v_updates := v_updates || format('%I = NULL', v_col);
                ELSE v_updates := v_updates || format('%I = %L', v_col, v_val); END IF;
            END IF;
        END LOOP;
        IF v_updates <> '' THEN EXECUTE format('UPDATE %I.%I SET %s WHERE %s', p_schema, p_table, v_updates, v_pk_where); END IF;
    ELSE
        v_cols := ''; v_vals := '';
        FOR v_col IN SELECT jsonb_object_keys(v_data) LOOP
            IF v_cols <> '' THEN v_cols := v_cols || ', '; v_vals := v_vals || ', '; END IF;
            v_cols := v_cols || format('%I', v_col);
            v_val := v_data->>v_col;
            IF v_val IS NULL THEN v_vals := v_vals || 'NULL'; ELSE v_vals := v_vals || format('%L', v_val); END IF;
        END LOOP;
        EXECUTE format('INSERT INTO %I.%I (%s) VALUES (%s)', p_schema, p_table, v_cols, v_vals);
    END IF;
    RETURN true;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pgtrack.undo_last_change(p_schema TEXT, p_table TEXT, p_row_pk JSONB)
RETURNS BOOLEAN AS $$
DECLARE v_last_version INTEGER; v_pk_where TEXT := ''; v_col TEXT; v_last_op TEXT;
BEGIN
    SELECT version, operation INTO v_last_version, v_last_op FROM pgtrack.change_history
    WHERE schema_name = p_schema AND table_name = p_table AND row_pk = p_row_pk ORDER BY version DESC LIMIT 1;
    IF v_last_version IS NULL THEN RAISE EXCEPTION 'No history found for row %', p_row_pk; END IF;
    
    -- If the last operation was INSERT (version 1), delete the row
    IF v_last_op = 'INSERT' THEN
        FOR v_col IN SELECT jsonb_object_keys(p_row_pk) LOOP
            IF v_pk_where <> '' THEN v_pk_where := v_pk_where || ' AND '; END IF;
            v_pk_where := v_pk_where || format('%I = %L', v_col, p_row_pk->>v_col);
        END LOOP;
        EXECUTE format('DELETE FROM %I.%I WHERE %s', p_schema, p_table, v_pk_where);
        RETURN true;
    END IF;
    
    -- Otherwise revert to the previous version's state
    RETURN pgtrack.revert_to_version(p_schema, p_table, p_row_pk, v_last_version - 1);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pgtrack.restore_deleted(p_schema TEXT, p_table TEXT, p_search_criteria JSONB DEFAULT NULL)
RETURNS TABLE(restored BOOLEAN, row_pk JSONB, row_data JSONB) AS $$
DECLARE v_deleted RECORD; v_cols TEXT; v_vals TEXT; v_col TEXT; v_val TEXT; v_data JSONB;
BEGIN
    FOR v_deleted IN SELECT ch.row_pk, ch.old_data FROM pgtrack.change_history ch
                     WHERE ch.schema_name = p_schema AND ch.table_name = p_table AND ch.operation = 'DELETE'
                       AND (p_search_criteria IS NULL OR ch.old_data @> p_search_criteria) ORDER BY ch.changed_at DESC LOOP
        v_data := v_deleted.old_data; v_cols := ''; v_vals := '';
        FOR v_col IN SELECT jsonb_object_keys(v_data) LOOP
            IF v_cols <> '' THEN v_cols := v_cols || ', '; v_vals := v_vals || ', '; END IF;
            v_cols := v_cols || format('%I', v_col);
            v_val := v_data->>v_col;
            IF v_val IS NULL THEN v_vals := v_vals || 'NULL'; ELSE v_vals := v_vals || format('%L', v_val); END IF;
        END LOOP;
        BEGIN
            EXECUTE format('INSERT INTO %I.%I (%s) VALUES (%s)', p_schema, p_table, v_cols, v_vals);
            restored := true;
        EXCEPTION WHEN unique_violation THEN restored := false;
        END;
        row_pk := v_deleted.row_pk; row_data := v_data; RETURN NEXT;
        IF p_search_criteria IS NOT NULL THEN EXIT; END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- QUERY FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION pgtrack.get_row_history(p_schema TEXT, p_table TEXT, p_row_pk JSONB)
RETURNS TABLE(version INTEGER, operation TEXT, changed_at TIMESTAMPTZ, changed_by TEXT, old_data JSONB, new_data JSONB, changed_columns TEXT[]) AS $$
BEGIN
    RETURN QUERY SELECT ch.version, ch.operation, ch.changed_at, ch.changed_by, ch.old_data, ch.new_data, ch.changed_columns
    FROM pgtrack.change_history ch WHERE ch.schema_name = p_schema AND ch.table_name = p_table AND ch.row_pk = p_row_pk ORDER BY ch.version;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pgtrack.find_deleted(p_schema TEXT, p_table TEXT, p_search_criteria JSONB DEFAULT NULL)
RETURNS TABLE(version INTEGER, deleted_at TIMESTAMPTZ, deleted_by TEXT, row_data JSONB) AS $$
BEGIN
    RETURN QUERY SELECT ch.version, ch.changed_at, ch.changed_by, ch.old_data FROM pgtrack.change_history ch
    WHERE ch.schema_name = p_schema AND ch.table_name = p_table AND ch.operation = 'DELETE'
      AND (p_search_criteria IS NULL OR ch.old_data @> p_search_criteria) ORDER BY ch.changed_at DESC;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pgtrack.get_stats()
RETURNS TABLE(schema_name TEXT, table_name TEXT, total_changes BIGINT, inserts BIGINT, updates BIGINT, deletes BIGINT) AS $$
BEGIN
    RETURN QUERY SELECT ch.schema_name, ch.table_name, COUNT(*)::BIGINT,
         COUNT(*) FILTER (WHERE ch.operation = 'INSERT')::BIGINT,
        COUNT(*) FILTER (WHERE ch.operation = 'UPDATE')::BIGINT,
        COUNT(*) FILTER (WHERE ch.operation = 'DELETE')::BIGINT
    FROM pgtrack.change_history ch GROUP BY ch.schema_name, ch.table_name;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PGTRACK - FLEXIBLE HUMAN-FRIENDLY API
-- Supports ANY primary key column name, not just 'id'
-- ============================================================================

-- Drop old functions first
DROP FUNCTION IF EXISTS pgtrack.history(TEXT, INTEGER, TEXT);
DROP FUNCTION IF EXISTS pgtrack.undo(TEXT, INTEGER, TEXT);
DROP FUNCTION IF EXISTS pgtrack.revert(TEXT, INTEGER, INTEGER, TEXT);
DROP FUNCTION IF EXISTS pgtrack.rollback_to(TEXT, INTEGER, TIMESTAMPTZ, TEXT);
DROP FUNCTION IF EXISTS pgtrack.restore(TEXT, INTEGER, TEXT);
DROP FUNCTION IF EXISTS pgtrack.changes(TEXT, INTEGER, TEXT);
DROP FUNCTION IF EXISTS pgtrack.deleted(TEXT, INTEGER, TEXT);

-- ============================================================================
-- HELPER: Get primary key column name for a table
-- ============================================================================
CREATE OR REPLACE FUNCTION pgtrack._get_pk_name(p_schema TEXT, p_table TEXT)
RETURNS TEXT AS $$
DECLARE v_pk_col TEXT;
BEGIN
    SELECT a.attname INTO v_pk_col
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = i.indkey[0]
    WHERE n.nspname = p_schema AND c.relname = p_table AND i.indisprimary
    LIMIT 1;
    RETURN v_pk_col;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- HELPER: Build PK JSONB from value and column name
-- ============================================================================
CREATE OR REPLACE FUNCTION pgtrack._build_pk(p_schema TEXT, p_table TEXT, p_value ANYELEMENT)
RETURNS JSONB AS $$
DECLARE v_pk_col TEXT;
BEGIN
    v_pk_col := pgtrack._get_pk_name(p_schema, p_table);
    IF v_pk_col IS NULL THEN
        RAISE EXCEPTION 'Table %.% has no primary key', p_schema, p_table;
    END IF;
    RETURN jsonb_build_object(v_pk_col, p_value);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FLEXIBLE HISTORY - Works with any PK type
-- ============================================================================

-- history('table', pk_value) - Auto-detects PK column
CREATE OR REPLACE FUNCTION pgtrack.history(
    p_table TEXT,
    p_pk_value ANYELEMENT,
    p_schema TEXT DEFAULT 'public'
)
RETURNS TABLE(
    ver INTEGER, 
    op TEXT, 
    changed_at TIMESTAMPTZ, 
    who TEXT,
    what TEXT[],
    before JSONB,
    after JSONB
) AS $$
DECLARE v_pk JSONB;
BEGIN
    v_pk := pgtrack._build_pk(p_schema, p_table, p_pk_value);
    RETURN QUERY 
    SELECT h.version, h.operation, h.changed_at, h.changed_by, h.changed_columns, h.old_data, h.new_data
    FROM pgtrack.get_row_history(p_schema, p_table, v_pk) h;
END;
$$ LANGUAGE plpgsql;

-- history_pk('table', '{"user_id": 123}') - Explicit JSONB PK
CREATE OR REPLACE FUNCTION pgtrack.history_pk(
    p_table TEXT,
    p_pk JSONB,
    p_schema TEXT DEFAULT 'public'
)
RETURNS TABLE(
    ver INTEGER, 
    op TEXT, 
    changed_at TIMESTAMPTZ, 
    who TEXT,
    what TEXT[],
    before JSONB,
    after JSONB
) AS $$
BEGIN
    RETURN QUERY 
    SELECT h.version, h.operation, h.changed_at, h.changed_by, h.changed_columns, h.old_data, h.new_data
    FROM pgtrack.get_row_history(p_schema, p_table, p_pk) h;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FLEXIBLE UNDO
-- ============================================================================

-- undo('table', pk_value) - Auto-detects PK column
CREATE OR REPLACE FUNCTION pgtrack.undo(
    p_table TEXT,
    p_pk_value ANYELEMENT,
    p_schema TEXT DEFAULT 'public'
)
RETURNS TEXT AS $$
DECLARE v_pk JSONB; v_result BOOLEAN; v_pk_col TEXT;
BEGIN
    v_pk_col := pgtrack._get_pk_name(p_schema, p_table);
    v_pk := jsonb_build_object(v_pk_col, p_pk_value);
    v_result := pgtrack.undo_last_change(p_schema, p_table, v_pk);
    IF v_result THEN
        RETURN 'Undo successful for ' || p_table || ' ' || v_pk_col || '=' || p_pk_value;
    ELSE
        RETURN 'Undo failed';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- undo_pk('table', '{"user_id": 123}') - Explicit JSONB PK
CREATE OR REPLACE FUNCTION pgtrack.undo_pk(
    p_table TEXT,
    p_pk JSONB,
    p_schema TEXT DEFAULT 'public'
)
RETURNS TEXT AS $$
DECLARE v_result BOOLEAN;
BEGIN
    v_result := pgtrack.undo_last_change(p_schema, p_table, p_pk);
    IF v_result THEN RETURN 'Undo successful for ' || p_table || ' pk=' || p_pk;
    ELSE RETURN 'Undo failed'; END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FLEXIBLE REVERT
-- ============================================================================

-- revert('table', pk_value, version) - Auto-detects PK column
CREATE OR REPLACE FUNCTION pgtrack.revert(
    p_table TEXT,
    p_pk_value ANYELEMENT,
    p_version INTEGER,
    p_schema TEXT DEFAULT 'public'
)
RETURNS TEXT AS $$
DECLARE v_pk JSONB; v_result BOOLEAN; v_pk_col TEXT;
BEGIN
    v_pk_col := pgtrack._get_pk_name(p_schema, p_table);
    v_pk := jsonb_build_object(v_pk_col, p_pk_value);
    v_result := pgtrack.revert_to_version(p_schema, p_table, v_pk, p_version);
    IF v_result THEN
        RETURN 'Reverted ' || p_table || ' ' || v_pk_col || '=' || p_pk_value || ' to version ' || p_version;
    ELSE
        RETURN 'Revert failed';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- revert_pk('table', '{"uuid": "abc"}', version) - Explicit JSONB PK
CREATE OR REPLACE FUNCTION pgtrack.revert_pk(
    p_table TEXT,
    p_pk JSONB,
    p_version INTEGER,
    p_schema TEXT DEFAULT 'public'
)
RETURNS TEXT AS $$
DECLARE v_result BOOLEAN;
BEGIN
    v_result := pgtrack.revert_to_version(p_schema, p_table, p_pk, p_version);
    IF v_result THEN RETURN 'Reverted ' || p_table || ' to version ' || p_version;
    ELSE RETURN 'Revert failed'; END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FLEXIBLE ROLLBACK TO TIME
-- ============================================================================

CREATE OR REPLACE FUNCTION pgtrack.rollback_to(
    p_table TEXT,
    p_pk_value ANYELEMENT,
    p_time TIMESTAMPTZ,
    p_schema TEXT DEFAULT 'public'
)
RETURNS TEXT AS $$
DECLARE v_pk JSONB; v_version INTEGER; v_result BOOLEAN; v_pk_col TEXT;
BEGIN
    v_pk_col := pgtrack._get_pk_name(p_schema, p_table);
    v_pk := jsonb_build_object(v_pk_col, p_pk_value);
    
    SELECT h.version INTO v_version FROM pgtrack.change_history h
    WHERE h.schema_name = p_schema AND h.table_name = p_table AND h.row_pk = v_pk AND h.changed_at <= p_time
    ORDER BY h.changed_at DESC LIMIT 1;
    
    IF v_version IS NULL THEN RETURN 'No history found before ' || p_time; END IF;
    
    v_result := pgtrack.revert_to_version(p_schema, p_table, v_pk, v_version);
    RETURN 'Rolled back ' || p_table || ' ' || v_pk_col || '=' || p_pk_value || ' to version ' || v_version;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FLEXIBLE RESTORE
-- ============================================================================

-- restore('table', pk_value) - Auto-detects PK column
CREATE OR REPLACE FUNCTION pgtrack.restore(
    p_table TEXT,
    p_pk_value ANYELEMENT,
    p_schema TEXT DEFAULT 'public'
)
RETURNS TEXT AS $$
DECLARE v_pk JSONB; v_restored RECORD; v_pk_col TEXT;
BEGIN
    v_pk_col := pgtrack._get_pk_name(p_schema, p_table);
    v_pk := jsonb_build_object(v_pk_col, p_pk_value);
    
    SELECT * INTO v_restored FROM pgtrack.restore_deleted(p_schema, p_table, v_pk) LIMIT 1;
    
    IF v_restored.restored THEN
        RETURN 'Restored ' || p_table || ' ' || v_pk_col || '=' || p_pk_value;
    ELSE
        RETURN 'Could not restore (row may already exist or not found in history)';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- restore_pk('table', '{"product_id": 456}') - Explicit JSONB PK
CREATE OR REPLACE FUNCTION pgtrack.restore_pk(
    p_table TEXT,
    p_pk JSONB,
    p_schema TEXT DEFAULT 'public'
)
RETURNS TEXT AS $$
DECLARE v_restored RECORD;
BEGIN
    SELECT * INTO v_restored FROM pgtrack.restore_deleted(p_schema, p_table, p_pk) LIMIT 1;
    IF v_restored.restored THEN RETURN 'Restored ' || p_table || ' pk=' || p_pk;
    ELSE RETURN 'Could not restore'; END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FLEXIBLE CHANGES / DELETED VIEWERS
-- ============================================================================

CREATE OR REPLACE FUNCTION pgtrack.changes(
    p_table TEXT,
    p_limit INTEGER DEFAULT 20,
    p_schema TEXT DEFAULT 'public'
)
RETURNS TABLE(row_pk JSONB, ver INTEGER, op TEXT, changed_at TIMESTAMPTZ, who TEXT, what TEXT[]) AS $$
BEGIN
    RETURN QUERY SELECT ch.row_pk, ch.version, ch.operation, ch.changed_at, ch.changed_by, ch.changed_columns
    FROM pgtrack.change_history ch WHERE ch.schema_name = p_schema AND ch.table_name = p_table
    ORDER BY ch.changed_at DESC LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pgtrack.deleted(
    p_table TEXT,
    p_limit INTEGER DEFAULT 20,
    p_schema TEXT DEFAULT 'public'
)
RETURNS TABLE(row_pk JSONB, deleted_at TIMESTAMPTZ, who TEXT, data JSONB) AS $$
BEGIN
    RETURN QUERY SELECT ch.row_pk, ch.changed_at, ch.changed_by, ch.old_data
    FROM pgtrack.change_history ch WHERE ch.schema_name = p_schema AND ch.table_name = p_table AND ch.operation = 'DELETE'
    ORDER BY ch.changed_at DESC LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- HELP
-- ============================================================================

DROP FUNCTION IF EXISTS pgtrack.help();
CREATE OR REPLACE FUNCTION pgtrack.help()
RETURNS TABLE(command TEXT, description TEXT, example TEXT) AS $$
BEGIN
    RETURN QUERY VALUES
    ('track(schema)', 'Start tracking all tables', 'SELECT * FROM pgtrack.track(''public'')'),
    ('untrack(schema)', 'Stop tracking', 'SELECT * FROM pgtrack.untrack(''public'')'),
    ('history(table, pk)', 'View row history (any PK type)', 'SELECT * FROM pgtrack.history(''users'', 123)'),
    ('history_pk(table, jsonb)', 'History with composite PK', 'SELECT * FROM pgtrack.history_pk(''items'', ''{"a":1,"b":2}'')'),
    ('changes(table)', 'Recent changes', 'SELECT * FROM pgtrack.changes(''users'')'),
    ('undo(table, pk)', 'Undo last change', 'SELECT pgtrack.undo(''users'', 123)'),
    ('undo_pk(table, jsonb)', 'Undo with composite PK', 'SELECT pgtrack.undo_pk(''items'', ''{"a":1,"b":2}'')'),
    ('revert(table, pk, ver)', 'Revert to version', 'SELECT pgtrack.revert(''users'', 123, 3)'),
    ('revert_pk(table, jsonb, ver)', 'Revert with composite PK', 'SELECT pgtrack.revert_pk(''items'', ''{"a":1}'', 2)'),
    ('rollback_to(table, pk, time)', 'Revert to point in time', 'SELECT pgtrack.rollback_to(''users'', 1, ''2024-01-01'')'),
    ('deleted(table)', 'Show deleted rows', 'SELECT * FROM pgtrack.deleted(''users'')'),
    ('restore(table, pk)', 'Restore deleted row', 'SELECT pgtrack.restore(''users'', 123)'),
    ('restore_pk(table, jsonb)', 'Restore with composite PK', 'SELECT pgtrack.restore_pk(''items'', ''{"a":1}'')'),
    ('info()', 'Show statistics', 'SELECT * FROM pgtrack.info()'),
    ('help()', 'Show this help', 'SELECT * FROM pgtrack.help()');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRACK SHORTCUT
-- ============================================================================

-- pgtrack.track('schema_name') - Start tracking a schema
CREATE OR REPLACE FUNCTION pgtrack.track(p_schema TEXT DEFAULT 'public')
RETURNS TABLE(table_name TEXT, status TEXT) AS $$
BEGIN
    RETURN QUERY SELECT * FROM pgtrack.enable_tracking(p_schema);
END;
$$ LANGUAGE plpgsql;

-- pgtrack.untrack('schema_name') - Stop tracking a schema
CREATE OR REPLACE FUNCTION pgtrack.untrack(p_schema TEXT DEFAULT 'public')
RETURNS TABLE(table_name TEXT, status TEXT) AS $$
BEGIN
    RETURN QUERY SELECT * FROM pgtrack.disable_tracking(p_schema);
END;
$$ LANGUAGE plpgsql;

-- Done!
SELECT 'pg_track installed successfully! Version: ' || pgtrack.version() AS result;
SELECT 'Flexible API installed! Works with any PK column name.' AS info;
SELECT 'Run: SELECT * FROM pgtrack.help() for all commands' AS hint;
