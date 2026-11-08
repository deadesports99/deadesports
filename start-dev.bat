@echo off
REM Start the tournament backend with tsx watch (auto-reload on file save).
REM Logs go to backend\dev-server.log — tail that file when something looks off.
cd /d "%~dp0backend"
node node_modules\tsx\dist\cli.mjs watch src/server.ts >> dev-server.log 2>&1
