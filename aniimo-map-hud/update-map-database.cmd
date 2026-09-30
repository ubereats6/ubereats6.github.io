@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0update-map-database.ps1"
if errorlevel 1 echo Update failed. Check egg-map files and folder location.
pause
