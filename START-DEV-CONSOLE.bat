@echo off
title Phone Dev Console - Free Fire Tournament
cd /d "%~dp0"
echo ====================================================
echo   Phone Dev Console  ^|  build + install fatak fatak
echo ====================================================
echo.
echo  Laptop se:  http://localhost:5199
echo  Phone     :  http://localhost:5199   (adb reverse ke baad)
echo.
echo  Phone panel par ye sab milega:
echo    - Player / Admin tap = build + install + launch
echo    - Watcher ON = file save karte hi APK phone me install
echo    - Live logcat + build log + phone screenshot
echo.
start "" http://localhost:5199
node scripts\dev-console.mjs
pause
