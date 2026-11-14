@echo off
REM ── Spartan Arena local stack ─────────────────────────────────────────────
REM Starts local Postgres + Redis (Docker), the backend and the admin console.
REM Everything runs on this machine: DB on :5433, backend on :5000,
REM admin console on :5174 (the fixed origin the backend CSRF gate expects).
REM
REM First time only:
REM   cd backend && npm install && npm run seed && npm run seed:owner
REM   cd admin-web && npm install
REM
REM Switch the backend back to the hosted Supabase DB: copy backend\.env.supabase.bak
REM over backend\.env and restart the backend.
REM ──────────────────────────────────────────────────────────────────────────
setlocal
cd /d "%~dp0"

echo [1/3] Local Postgres (:5433) + Redis (:6379)...
docker compose -f backend\docker-compose.dev.yml up -d

echo [2/3] Backend on http://localhost:5000 ...
start "backend :5000" cmd /k "cd /d %~dp0backend && npm run dev"

echo [3/3] Admin console on http://localhost:5174 ...
start "admin-web :5174" cmd /k "cd /d %~dp0admin-web && npm run dev"

timeout /t 4 /nobreak >nul
start "" http://localhost:5174

echo.
echo Local stack starting. Dev OTP appears in the admin console's DEV chip
echo (it is also logged by the backend window).
endlocal
