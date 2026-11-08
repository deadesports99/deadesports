@echo off
REM ============================================================
REM  WorkBuddy AI  -  India DNS block bypass (permanent fix)
REM  Ye file RIGHT-CLICK -> "Run as administrator" se chalayein.
REM  www.workbuddy.ai abhi India me 0.0.0.1 par null-route hai,
REM  isliye app ka login "AUTH_NETWORK_ERROR: getaddrinfo ENOENT"
REM  deta tha. Ye script sahi IP hosts file me daal deta hai.
REM ============================================================
setlocal
net session >nul 2>&1
if errorlevel 1 (
  echo [X] Admin rights nahi hain. Right-click -^> Run as administrator.
  pause
  exit /b 1
)

set "HOSTS=%SystemRoot%\System32\drivers\etc\hosts"

echo [1/3] Backup: %HOSTS%.workbuddy-backup
copy /Y "%HOSTS%" "%HOSTS%.workbuddy-backup" >nul

echo [2/3] Purani workbuddy/codebuddy entries hata rahe hain...
findstr /V /I "workbuddy.ai codebuddy.ai" "%HOSTS%" > "%TEMP%\hosts.clean"
copy /Y "%TEMP%\hosts.clean" "%HOSTS%" >nul

echo [3/3] Nayi entries likh rahe hain...
>>"%HOSTS%" echo.
>>"%HOSTS%" echo # WorkBuddy AI - DNS block bypass
>>"%HOSTS%" echo 43.169.32.91 www.workbuddy.ai
>>"%HOSTS%" echo 43.169.32.91 workbuddy.ai

ipconfig /flushdns >nul
echo.
echo [OK] Done. Ab WorkBuddy AI band karke dobara kholen.
echo      Verify:  ping www.workbuddy.ai   -^>  43.169.32.91 aana chahiye
echo.
pause
