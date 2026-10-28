@echo off
rem WorkLife Planner (Windows) - install. No account needed; everything stays on this PC.
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0local\install.ps1"
if errorlevel 1 (
  echo.
  echo   [X] Install failed. See the message above.
  echo.
)
pause
