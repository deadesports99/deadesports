@echo off
REM One-click reward-module switches (see features.ps1 for usage).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0features.ps1" %*
