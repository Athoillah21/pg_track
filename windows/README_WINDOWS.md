# Building pg_track on Windows

## Supported PostgreSQL Versions

| Version | Status |
|---------|--------|
| PostgreSQL 18 | ✅ Supported |
| PostgreSQL 17 | ✅ Supported |
| PostgreSQL 16 | ✅ Supported |
| PostgreSQL 15 | ✅ Supported |

## Prerequisites

1. **PostgreSQL 15-18** installed with development files
   - Download from: https://www.postgresql.org/download/windows/
   - During installation, ensure "Development files" is selected

2. **Visual Studio Build Tools** (or full Visual Studio)
   - Download from: https://visualstudio.microsoft.com/downloads/
   - Install "Desktop development with C++"

## Building

### Using build.bat (Recommended)

1. Open **x64 Native Tools Command Prompt for VS 2022**

2. Navigate to pg_track directory:
   ```batch
   cd C:\path\to\pg_track
   ```

3. Build for your PostgreSQL version:
   ```batch
   REM For PostgreSQL 15 (default)
   windows\build.bat

   REM For PostgreSQL 16
   windows\build.bat 16

   REM For PostgreSQL 17
   windows\build.bat 17

   REM For PostgreSQL 18
   windows\build.bat 18
   ```

4. When prompted, type `y` to install (requires Administrator)

### Manual Build

```batch
set PG_VERSION=16
set PG_ROOT=C:\Program Files\PostgreSQL\%PG_VERSION%

cl /LD /MD /O2 ^
    /I"%PG_ROOT%\include" ^
    /I"%PG_ROOT%\include\server" ^
    /I"%PG_ROOT%\include\server\port\win32" ^
    /I"%PG_ROOT%\include\server\port\win32_msvc" ^
    /D "WIN32" /D "_WINDOWS" /D "NDEBUG" ^
    src\pg_track.c ^
    /Fe"pg_track.dll" ^
    /link /LIBPATH:"%PG_ROOT%\lib" postgres.lib
```

### Install (Run as Administrator)

```batch
set PG_VERSION=16
copy pg_track.dll "C:\Program Files\PostgreSQL\%PG_VERSION%\lib\"
copy pg_track.control "C:\Program Files\PostgreSQL\%PG_VERSION%\share\extension\"
copy sql\pg_track--1.0.sql "C:\Program Files\PostgreSQL\%PG_VERSION%\share\extension\"
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `postgres.lib not found` | Ensure PostgreSQL was installed with development files |
| `cl is not recognized` | Run from Visual Studio Developer Command Prompt |
| `Access denied` | Run command prompt as Administrator |
| `LNK4272: machine type x64 conflicts` | **WRONG TERMINAL**. Open **x64 Native Tools Command Prompt** (not default VS Prompt) |
| `LNK2019: unresolved external symbol` | **WRONG TERMINAL**. Open **x64 Native Tools Command Prompt** |
| DLL not loading | Restart PostgreSQL service after installation |
