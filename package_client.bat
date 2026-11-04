@echo off
REM ============================================================================
REM  FREE FIRE TOURNAMENT PLATFORM - 1-CLICK WHITE-LABEL PACKAGER
REM
REM  Usage (from the repo root):
REM     package_client.bat sample_client
REM     package_client.bat alpha_esports --release
REM     package_client.bat clients\alpha_esports --no-build
REM
REM  Reads clients\<name>\client_config.json, injects the branding into both
REM  Android apps, builds them, and copies the APKs to dist\<name>\.
REM  Requires: Node.js 18+ (already needed for the backend) and the Android SDK.
REM ============================================================================
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo [X] Node.js not found. Install Node 18+ first ^(https://nodejs.org^).
    exit /b 1
)

if "%~1"=="" (
    echo.
    echo   Usage: package_client.bat ^<client_folder^> [--release] [--no-build] [--keep]
    echo.
    echo   Example: package_client.bat sample_client
    echo.
    exit /b 1
)

node "%~dp0tools\package_client.mjs" %*
set EXITCODE=%ERRORLEVEL%

if not "%EXITCODE%"=="0" (
    echo.
    echo [X] Packaging failed with exit code %EXITCODE%.
    exit /b %EXITCODE%
)

echo.
echo [OK] Packaging complete. Check the dist\ folder.
exit /b 0
