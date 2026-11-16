@echo off
title FF Test Phone (emulator)
cd /d "%~dp0"
set "SDK=%LOCALAPPDATA%\Android\Sdk"

"%SDK%\platform-tools\adb.exe" devices | findstr /C:"emulator-5554" >nul
if %errorlevel%==0 (
    echo [i] Emulator pehle se chal raha hai ^(emulator-5554^).
    goto :ready
)

echo [i] ffTest emulator boot ho raha hai...
start "" "%SDK%\emulator\emulator.exe" -avd ffTest -port 5554 -no-boot-anim -no-snapshot-save -gpu auto -memory 3072
echo     boot hone me ~40-60s lagta hai, window khud khul jayegi.

:ready
"%SDK%\platform-tools\adb.exe" wait-for-device
echo [i] adb connected. Panel: http://localhost:5199
echo.
pause
