@echo off
cd /d "%~dp0" & title WorkLife Planner - Update & (if exist "%~dp0.local\node\node.exe" ("%~dp0.local\node\node.exe" "%~dp0local\update.mjs" %*) else (echo. & echo   Not installed yet. Please double-click install.bat first. & echo.)) & pause & exit /b
