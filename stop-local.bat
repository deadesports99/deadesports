@echo off
REM Stops the local Postgres + Redis containers. Close the backend and
REM admin-web terminal windows to stop those dev servers.
setlocal
cd /d "%~dp0"
echo Stopping local Postgres + Redis...
docker compose -f backend\docker-compose.dev.yml down
echo Done. (The ff-pg-data volume is kept, so seed data survives.)
endlocal
