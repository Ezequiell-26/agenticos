@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-Agenticos-Desktop.ps1"
set "AGENTICOS_EXIT=%ERRORLEVEL%"
if not "%AGENTICOS_EXIT%"=="0" (
  echo.
  echo AgentiCOS no pudo iniciarse. Revisa el mensaje anterior.
  pause
)
exit /b %AGENTICOS_EXIT%
