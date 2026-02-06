-- =================================================================
-- pg_track Dashboard Test Script
-- Run this in psql to generate interesting history for the dashboard
-- =================================================================

-- 1. Create a dummy table (Drop first to avoid column mismatches)
DROP TABLE IF EXISTS public.employees CASCADE;

CREATE TABLE public.employees (
    id SERIAL PRIMARY KEY,
    name TEXT,
    role TEXT,
    salary INTEGER,
    status TEXT DEFAULT 'active'
);

-- 2. Enable Tracking
SELECT * FROM pgtrack.track('public');

-- 3. Insert Initial Data (Commit 1)
INSERT INTO public.employees (name, role, salary) VALUES 
('Alice Johnson', 'Engineer', 90000),
('Bob Smith', 'Manager', 120000),
('Charlie Brown', 'Intern', 30000);

-- 4. Make some updates (Commit 2 & 3)
UPDATE public.employees SET salary = 95000 WHERE name = 'Alice Johnson';
UPDATE public.employees SET status = 'on_leave' WHERE name = 'Bob Smith';

-- 5. Delete a record (Commit 4)
DELETE FROM public.employees WHERE name = 'Charlie Brown';

-- 6. Undo the deletion (Restore)
-- We find the ID of 'Charlie Brown' from the history log (it's in old_data because he was deleted)
SELECT pgtrack.restore('employees', (
    SELECT (old_data->>'id')::int 
    FROM pgtrack.change_history 
    WHERE table_name = 'employees' AND operation = 'DELETE' AND old_data->>'name' = 'Charlie Brown' 
    LIMIT 1
));

-- 7. More complex update
UPDATE public.employees SET role = 'Senior Engineer', salary = 105000 WHERE name = 'Alice Johnson';

-- Check results
\echo '---------------------------------------------------'
\echo 'History Generated! Check your Dashboard now.'
\echo '---------------------------------------------------'
SELECT count(*) || ' total history entries created.' as status FROM pgtrack.change_history;
