-- pg_track uninstall script
-- Use this to completely remove pg_track and its data

-- Drop the event trigger first (if exists)
DROP EVENT TRIGGER IF EXISTS pgtrack_ddl_trigger;

-- Remove all tracking triggers from tracked tables
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT schema_name, table_name 
        FROM pgtrack.tracked_tables
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS pgtrack_%I_trigger ON %I.%I',
            r.table_name, r.schema_name, r.table_name
        );
    END LOOP;
EXCEPTION
    WHEN undefined_table THEN NULL;
END $$;

-- Drop the schema (this removes all pgtrack objects)
DROP SCHEMA IF EXISTS pgtrack CASCADE;

\echo 'pg_track uninstalled successfully.'
