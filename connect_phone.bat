@echo off
title Reconnect Free Fire App
echo ====================================================
echo   ⚡ Thunder eSports - Reconnecting Phone to PC ⚡
echo ====================================================
echo.
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" devices
echo.
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" reverse tcp:5000 tcp:5000
echo.
echo ====================================================
echo  [SUCCESS] Reverse Proxy Connected (tcp:5000)
echo  Ab aap phone me app chala sakte hain!
echo ====================================================
pause
