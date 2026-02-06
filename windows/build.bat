@echo off
REM pg_track Windows Build Script
REM Supports PostgreSQL 15, 16, 17, 18
REM Requires: Visual Studio Build Tools, PostgreSQL development files

setlocal enabledelayedexpansion

REM ============================================================================
REM CONFIGURATION
REM ============================================================================

if "%1"=="" (set PG_VERSION=16) else (set PG_VERSION=%1)

set PG_ROOT=C:\Program Files\PostgreSQL\%PG_VERSION%
set PG_INCLUDE=%PG_ROOT%\include
set PG_INCLUDE_SERVER=%PG_ROOT%\include\server
set PG_LIB=%PG_ROOT%\lib
set PG_SHARE=%PG_ROOT%\share\extension

if not exist "%PG_ROOT%" (
    echo ERROR: PostgreSQL %PG_VERSION% not found at %PG_ROOT%
    exit /b 1
)

REM Check for Visual Studio environment
where cl >nul 2>&1
if errorlevel 1 (
    echo ERROR: Visual Studio compiler not found.
    echo Run from VS Developer Command Prompt.
    exit /b 1
)

echo.
echo ========================================================
echo Building pg_track for PostgreSQL %PG_VERSION%
echo ========================================================
echo.

if "%VSCMD_ARG_TGT_ARCH%" neq "x64" (
    echo WARN: You appear to be using a non-x64 compiler environment [%VSCMD_ARG_TGT_ARCH%].
    echo       PostgreSQL is typically 64-bit on Windows. 
    echo       If build fails with LNK4272, verify you are using the:
    echo       "x64 Native Tools Command Prompt for VS 2022"
    echo.
)

if not exist "build" mkdir build

echo Compiling pg_track.c...
cl /LD /MD /O2 ^
    /I"%PG_INCLUDE%" ^
    /I"%PG_INCLUDE_SERVER%" ^
    /I"%PG_INCLUDE_SERVER%\port\win32" ^
    /I"%PG_INCLUDE_SERVER%\port\win32_msvc" ^
    /D "WIN32" /D "_WINDOWS" /D "NDEBUG" ^
    src\pg_track.c ^
    /Fe"build\pg_track.dll" ^
    /link /LIBPATH:"%PG_LIB%" postgres.lib

if errorlevel 1 (
    echo ERROR: Compilation failed!
    exit /b 1
)

echo.
echo Build successful!
echo.
echo To install, run as Administrator:
echo   copy build\pg_track.dll "%PG_LIB%"
echo   copy pg_track.control "%PG_SHARE%"
echo   copy sql\pg_track--1.0.sql "%PG_SHARE%"
echo.

set /p INSTALL="Install now? (requires Administrator) [y/N]: "
if /i "%INSTALL%"=="y" (
    copy /y build\pg_track.dll "%PG_LIB%\"
    copy /y pg_track.control "%PG_SHARE%\"
    copy /y sql\pg_track--1.0.sql "%PG_SHARE%\"
    echo.
    echo Installation complete! Run 'CREATE EXTENSION pg_track;' in psql.
)

endlocal
