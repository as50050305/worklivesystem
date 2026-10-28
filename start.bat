@echo off
rem WorkLife Planner - start the local app (opens http://localhost:5858 in your browser)
rem Keep this window open while using the app. Close it to stop.
setlocal
cd /d "%~dp0"
title WorkLife Planner
set "NODE=%~dp0.local\node\node.exe"
if not exist "%NODE%" goto notinstalled
if not exist "%~dp0dist\index.html" goto notinstalled
"%NODE%" "%~dp0local\server.mjs" %*
if errorlevel 1 pause
exit /b

:notinstalled
echo.
echo   Not installed yet. Please double-click install.bat first.
echo.
pause
exit /b 1
