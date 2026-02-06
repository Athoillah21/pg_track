-- pg_track Usage Examples
-- Using the Human-Friendly API

-- ============================================================================
-- SETUP
-- ============================================================================

-- Install the extension (run single file)
-- \i 'path/to/pg_track--1.0.sql'

-- Show available commands
SELECT * FROM pgtrack.help();

-- Create test tables with DIFFERENT primary key names
CREATE SCHEMA IF NOT EXISTS demo;

-- Table with standard 'id' primary key
CREATE TABLE IF NOT EXISTS demo.users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    status TEXT DEFAULT 'active'
);

-- Table with 'user_id' as primary key
CREATE TABLE IF NOT EXISTS demo.customers (
    customer_id SERIAL PRIMARY KEY,
    company_name TEXT NOT NULL,
    contact_email TEXT
);

-- Table with UUID as primary key
CREATE TABLE IF NOT EXISTS demo.products (
    product_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    price DECIMAL(10,2),
    stock INTEGER DEFAULT 0
);

-- Table with composite primary key
CREATE TABLE IF NOT EXISTS demo.order_items (
    order_id INTEGER,
    product_id INTEGER,
    quantity INTEGER NOT NULL,
    PRIMARY KEY (order_id, product_id)
);

-- Enable tracking (all tables, any PK type)
SELECT * FROM pgtrack.track('demo');

-- ============================================================================
-- SCENARIO 1: Standard 'id' Primary Key
-- ============================================================================
\echo ''
\echo '=== SCENARIO 1: Table with id PK ==='

INSERT INTO demo.users (name, email) VALUES ('Alice', 'alice@test.com');
UPDATE demo.users SET name = 'Alicia' WHERE id = 1;

-- View history (auto-detects 'id' column)
SELECT * FROM pgtrack.history('users', 1, 'demo');

-- Undo last change
SELECT pgtrack.undo('users', 1, 'demo');
SELECT name FROM demo.users WHERE id = 1;  -- Back to 'Alice'

-- ============================================================================
-- SCENARIO 2: Custom 'customer_id' Primary Key
-- ============================================================================
\echo ''
\echo '=== SCENARIO 2: Table with customer_id PK ==='

INSERT INTO demo.customers (company_name, contact_email) VALUES ('Acme Corp', 'info@acme.com');
UPDATE demo.customers SET company_name = 'ACME Corporation' WHERE customer_id = 1;

-- View history (auto-detects 'customer_id' column!)
SELECT ver, op, what FROM pgtrack.history('customers', 1, 'demo');

-- Undo (message shows 'customer_id=1', not 'id=1')
SELECT pgtrack.undo('customers', 1, 'demo');

-- ============================================================================
-- SCENARIO 3: UUID Primary Key
-- ============================================================================
\echo ''
\echo '=== SCENARIO 3: Table with UUID PK ==='

INSERT INTO demo.products (name, price) VALUES ('Widget', 29.99);
UPDATE demo.products SET price = 39.99 WHERE name = 'Widget';

-- For UUID keys, use history_pk with explicit JSONB
SELECT ver, op, what FROM pgtrack.history_pk(
    'products',
    (SELECT jsonb_build_object('product_uuid', product_uuid) FROM demo.products LIMIT 1),
    'demo'
);

-- ============================================================================
-- SCENARIO 4: Composite Primary Key
-- ============================================================================
\echo ''
\echo '=== SCENARIO 4: Composite PK (order_id, product_id) ==='

INSERT INTO demo.order_items VALUES (1, 100, 5);
UPDATE demo.order_items SET quantity = 10 WHERE order_id = 1 AND product_id = 100;

-- Use _pk functions for composite keys
SELECT ver, op, what FROM pgtrack.history_pk(
    'order_items',
    '{"order_id": 1, "product_id": 100}'::jsonb,
    'demo'
);

-- Undo with composite key
SELECT pgtrack.undo_pk('order_items', '{"order_id": 1, "product_id": 100}', 'demo');

-- ============================================================================
-- SCENARIO 5: Delete and Restore
-- ============================================================================
\echo ''
\echo '=== SCENARIO 5: Delete and Restore ==='

DELETE FROM demo.users WHERE id = 1;

-- Find deleted rows
SELECT * FROM pgtrack.deleted('users', 10, 'demo');

-- Restore by primary key
SELECT pgtrack.restore('users', 1, 'demo');

-- Verify restored
SELECT * FROM demo.users;

-- ============================================================================
-- SCENARIO 6: Statistics
-- ============================================================================
\echo ''
\echo '=== SCENARIO 6: Statistics ==='

SELECT * FROM pgtrack.info();

-- ============================================================================
-- SUMMARY: Function Reference
-- ============================================================================
\echo ''
\echo '=== FUNCTION REFERENCE ==='

SELECT * FROM pgtrack.help();

-- ============================================================================
-- CLEANUP
-- ============================================================================

-- DROP SCHEMA demo CASCADE;
