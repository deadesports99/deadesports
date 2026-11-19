@echo off
REM ── Spartan Arena / Free Fire Tournament — one-click local stack ────────────
REM Starts, in order: Docker → Postgres + Redis → backend API → admin console →
REM player web → adb reverse (if a phone is connected) → opens the browser.
REM Safe to run twice: every step skips what is already up.
REM
REM Ports: DB 5433, Redis 6379, API 5000, player 5173, admin 5174, dev console 5199
REM Stop the API/webs by closing their windows; DB/Redis: stop-local.bat
REM
REM NOTE: waits use `ping`, never `timeout` — Git Bash ships a GNU `timeout`
REM that rejects /t and silently kills every wait in this script.
REM ──────────────────────────────────────────────────────────────────────────
setlocal EnableExtensions
cd /d "%~dp0"
title Spartan Arena - local stack

echo ============================================================
echo   Spartan Arena - local stack
echo ============================================================

REM ── 1. Docker Desktop ─────────────────────────────────────────────────────
echo.
echo [1/7] Docker Desktop ...
docker info >nul 2>&1
if not errorlevel 1 goto :docker_ok

echo       starting Docker Desktop (first boot ~20-40s) ...
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
set /a _n=0
:docker_wait
call :sleep 5
docker info >nul 2>&1 && goto :docker_ok
set /a _n+=1
if %_n% lss 36 goto :docker_wait
echo       [X] Docker did not come up. Start Docker Desktop by hand, rerun this file.
goto :end

:docker_ok
echo       daemon OK

REM ── 2. Postgres + Redis ───────────────────────────────────────────────────
echo.
echo [2/7] Postgres (:5433) + Redis (:6379) ...
docker compose -f backend\docker-compose.dev.yml up -d
set /a _n=0
:db_wait
docker inspect --format "{{.State.Health.Status}}" ff-postgres 2>nul | findstr /i "healthy" >nul && goto :db_ok
set /a _n+=1
if %_n% geq 30 goto :db_slow
call :sleep 2
goto :db_wait
:db_slow
echo       [!] health not confirmed yet - "docker ps" se check karo
goto :api
:db_ok
echo       postgres + redis healthy

REM ── 3. Backend API :5000 ──────────────────────────────────────────────────
:api
echo.
echo [3/7] Backend API on http://localhost:5000 ...
call :port_busy 5000
if not errorlevel 1 (echo       already running - skipped) else (start "backend :5000" cmd /k "cd /d %~dp0backend && npm run dev")
call :wait_port 5000 60

REM ── 4. Admin console :5174 ────────────────────────────────────────────────
echo.
echo [4/7] Admin console on http://localhost:5174 ...
call :port_busy 5174
if not errorlevel 1 (echo       already running - skipped) else (start "admin-web :5174" cmd /k "cd /d %~dp0admin-web && npm run dev")
call :wait_port 5174 60

REM ── 5. Player web :5173 ───────────────────────────────────────────────────
echo.
echo [5/7] Player web on http://localhost:5173 ...
call :port_busy 5173
if not errorlevel 1 (echo       already running - skipped) else (start "player-web :5173" cmd /k "cd /d %~dp0player-web && npm run dev")
call :wait_port 5173 60

REM ── 6. Phone bridge ───────────────────────────────────────────────────────
echo.
echo [6/7] Phone bridge (adb reverse tcp:5000) ...
REM Works with any number of devices (phone + emulator together).
REM NOTE: bare "adb get-state"/"adb reverse" fail with >1 device, so we loop serials.
set "_anydev="
for /f "skip=1 tokens=1,2" %%a in ('adb devices 2^>nul') do (
  if "%%b"=="device" (
    set "_anydev=1"
    adb -s %%a reverse tcp:5000 tcp:5000 >nul 2>&1
    adb -s %%a reverse tcp:5173 tcp:5173 >nul 2>&1
    adb -s %%a reverse tcp:5174 tcp:5174 >nul 2>&1
    adb -s %%a reverse tcp:5199 tcp:5199 >nul 2>&1
    echo       %%a - reverse 5000/5173/5174/5199 done
  )
)
if not defined _anydev (
  echo       no device attached - APK backend tak nahi pahunchegi
  echo       phone lagao + USB debugging ON, phir: connect_phone.bat
)

REM ── 7. Phone dev console :5199 (build+install, watcher, logcat) ────────
echo.
echo [7/7] Phone dev console on http://localhost:5199 ...
call :port_busy 5199
if not errorlevel 1 (echo       already running - skipped) else (start "dev-console :5199" cmd /k "cd /d %~dp0 && node scripts\dev-console.mjs")
call :wait_port 5199 60

echo.
echo ------------------------------------------------------------
echo   API     http://localhost:5000/health
echo   Console http://localhost:5199    (build+install+watcher+logcat)
echo   Admin   http://localhost:5174    (deadesports99@gmail.com + DEV OTP)
echo   Player  http://localhost:5173    (any 10-digit phone + any 6-digit OTP)
echo ------------------------------------------------------------
start "" http://localhost:5174
goto :end

REM ── helpers ───────────────────────────────────────────────────────────────
:port_busy
powershell -NoProfile -Command "if ((Test-NetConnection -ComputerName 127.0.0.1 -Port %1 -InformationLevel Quiet -WarningAction SilentlyContinue)) { exit 0 } else { exit 1 }" >nul 2>&1
exit /b %errorlevel%

:wait_port
set /a _tries=%2
:wp_loop
call :port_busy %1
if not errorlevel 1 goto :wp_ok
set /a _tries-=1
if %_tries% leq 0 goto :wp_fail
call :sleep 2
goto :wp_loop
:wp_ok
echo       listening
exit /b 0
:wp_fail
echo       [!] port %1 did not open - check that window for errors
exit /b 1

:sleep
set /a _s=%1
:sleep_loop
if %_s% leq 0 exit /b 0
ping -n 2 127.0.0.1 >nul 2>&1
set /a _s-=1
goto :sleep_loop

:end
echo.
echo Done. Ye window band kar sakte ho (servers apni windows me chalte hain).
call :sleep 8
endlocal
