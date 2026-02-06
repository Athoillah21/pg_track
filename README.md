# pg_track

Version control and change tracking for PostgreSQL tables.

[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15--18-blue.svg)](https://www.postgresql.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)
[![License](https://img.shields.io/badge/License-PostgreSQL-green.svg)](LICENSE)

## Overview

**pg_track** is a PostgreSQL extension that automatically tracks all changes (INSERT, UPDATE, DELETE) to your tables and allows you to revert data to any previous state. Think of it as "Git for your database tables."

Includes a **web dashboard** for visualizing changes, managing connections, and reverting data with one click.

> **Note**: Schema name is `pgtrack` (not `pg_track`) because PostgreSQL reserves the `pg_` prefix.

## Features

### PostgreSQL Extension
- ✅ **One-file installation** - Just run `pg_track--1.0.sql`
- ✅ **Schema-based tracking** - Enable tracking for entire schemas
- ✅ **Any primary key type** - Works with `id`, `uuid`, or composite keys
- ✅ **Human-friendly API** - Simple commands like `undo()`, `revert()`, `restore()`
- ✅ **Row-level versioning** - Every change creates a new version
- ✅ **Point-in-time recovery** - Revert to any timestamp
- ✅ **Deleted row recovery** - Restore accidentally deleted data

### Web Dashboard
- 🖥️ **Real-time activity feed** - See all changes as they happen
- 🔌 **Multi-database connections** - Connect to multiple PostgreSQL instances
- 🔒 **Secure password handling** - Passwords hashed with SHA-256, session encrypted with AES-256-GCM
- 🌙 **Dark mode** - Eye-friendly dark theme
- ↩️ **One-click revert** - Revert any change from the UI
- 📊 **Tracked tables view** - See all monitored tables and their status

---

## Project Structure

```
pg_track/
├── pg_track.control          # PostgreSQL extension metadata
├── Makefile                  # Build script (Linux/macOS)
├── README.md                 # This file
│
├── sql/                      # SQL Extension
│   ├── pg_track--1.0.sql     # Main extension (install this)
│   └── pg_track--uninstall.sql
│
├── src/                      # C Source (minimal stub)
│   └── pg_track.c
│
├── dashboard/                # Next.js Web Dashboard
│   ├── app/                  # Pages (App Router)
│   │   ├── page.tsx          # Overview/Home
│   │   ├── activity/         # Global activity stream
│   │   ├── tables/           # Tracked tables list
│   │   ├── connect/          # Connection manager
│   │   └── api/              # API routes
│   ├── actions/              # Server actions
│   │   ├── connection.ts     # Connection CRUD
│   │   ├── history.ts        # Change history queries
│   │   └── session.ts        # Session utilities
│   ├── components/           # React components
│   ├── lib/                  # Utilities
│   │   ├── db.ts             # Target database connection
│   │   ├── system-db.ts      # NeonDB (connection storage)
│   │   └── crypto.ts         # AES-256-GCM encryption
│   └── scripts/              # Setup scripts
│       └── init-system-db.js # Initialize NeonDB tables
│
├── examples/                 # Usage examples
│   └── usage_examples.sql
│
├── debian/                   # Debian packaging
├── rpm/                      # RPM packaging
└── windows/                  # Windows build scripts
```

---

## Installation

### 1. PostgreSQL Extension

#### Quick Install (Any OS)
```sql
-- In psql, run the main SQL file
\i 'path/to/pg_track/sql/pg_track--1.0.sql'

-- Enable tracking on your schema
SELECT * FROM pgtrack.track('public');

-- See all available commands
SELECT * FROM pgtrack.help();
```

#### Linux/macOS (PGXS)
```bash
git clone https://github.com/yourusername/pg_track.git
cd pg_track
make
sudo make install

# In psql:
CREATE EXTENSION pg_track;
```

### 2. Web Dashboard

#### Prerequisites
- Node.js 18+
- A NeonDB account (free tier works) for storing connections

#### Setup
```bash
cd dashboard
npm install

# Copy and configure environment
cp .env.example .env
```

Edit `.env`:
```env
# NeonDB connection string (stores your saved connections)
SYSTEM_DB_URL=postgresql://user:pass@host/neondb?sslmode=require

# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=your_32_byte_hex_key
```

Initialize the system database:
```bash
node scripts/init-system-db.js
```

Run the dashboard:
```bash
npm run dev
# Open http://localhost:3000
```

---

## Human-Friendly API

| Command | Description | Example |
|---------|-------------|---------|
| `track(schema)` | Start tracking | `SELECT * FROM pgtrack.track('public')` |
| `history(table, pk)` | View row history | `SELECT * FROM pgtrack.history('users', 1)` |
| `undo(table, pk)` | Undo last change | `SELECT pgtrack.undo('users', 1)` |
| `revert(table, pk, ver)` | Revert to version | `SELECT pgtrack.revert('users', 1, 3)` |
| `deleted(table)` | Show deleted rows | `SELECT * FROM pgtrack.deleted('users')` |
| `restore(table, pk)` | Restore deleted | `SELECT pgtrack.restore('users', 1)` |
| `info()` | Statistics | `SELECT * FROM pgtrack.info()` |
| `help()` | Show all commands | `SELECT * FROM pgtrack.help()` |

---

## Usage Examples

### Undo a Mistake
```sql
-- Made a wrong update?
UPDATE users SET email = 'wrong@email.com' WHERE id = 1;

-- Undo it!
SELECT pgtrack.undo('users', 1);
-- "Undo successful for users id=1"
```

### Restore Deleted Data
```sql
-- Accidentally deleted?
DELETE FROM users WHERE id = 1;

-- Find it
SELECT * FROM pgtrack.deleted('users');

-- Restore it
SELECT pgtrack.restore('users', 1);
-- "Restored users id=1"
```

### View Change History
```sql
SELECT * FROM pgtrack.history('users', 1);
-- Shows all versions of user id=1
```

---

## Dashboard Usage

### Adding a Connection
1. Go to `/connect`
2. Fill in connection details (host, port, database, username)
3. Enter password (will be hashed and stored securely)
4. Click "Save Connection"

### Connecting to a Database
1. Click "Connect" on any saved connection
2. Enter your password (verified against stored hash)
3. You'll be redirected to the Overview page

### Viewing Changes
- **Overview**: Recent changes across all tables
- **Global Activity**: Full activity stream with filters
- **Tracked Tables**: List of all monitored tables

### Reverting Changes
1. Find the change you want to revert
2. Click the "Revert" button
3. Confirm the action

---

## Security

### Password Handling
- Passwords are **never stored in plaintext**
- On save: Password → SHA-256 hash → stored in NeonDB
- On connect: Password verified against hash → encrypted with AES-256-GCM → stored in session cookie
- Session cookies are `httpOnly` and `secure` in production

### Environment Variables
| Variable | Description |
|----------|-------------|
| `SYSTEM_DB_URL` | NeonDB connection string |
| `ENCRYPTION_KEY` | 32-byte hex key for AES-256-GCM |

---

## Deployment

### Vercel (Recommended)
The dashboard is ready for Vercel deployment:
1. Push to GitHub
2. Import in Vercel
3. Set environment variables
4. Deploy!

---

## License

PostgreSQL License - see [LICENSE](LICENSE) file.
