@echo off
rem WorkLife Planner - local install (no account needed, everything stays on this PC)
rem Safe to run again: use it to update after the code changes. Your data folder is never touched.
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0local\install.ps1"
if errorlevel 1 (
  echo.
  echo   [X] Install failed. See the message above.
  echo.
)
pause
