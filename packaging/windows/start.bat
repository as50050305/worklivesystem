@echo off
rem WorkLife Planner (Windows) - start. Keep this window open while using the app; close it to stop.
setlocal
cd /d "%~dp0"
title WorkLife Planner
set "NODE=%~dp0.local\node\node.exe"
if not exist "%NODE%" goto notinstalled
"%NODE%" "%~dp0local\server.mjs" %*
if errorlevel 1 pause
exit /b

:notinstalled
echo.
echo   Not installed yet. Please double-click install.bat first.
echo.
pause
exit /b 1
