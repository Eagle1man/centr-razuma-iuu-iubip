@echo off
rem ============================================================
rem  DEV.bat - local dev server in its own console window.
rem  Double-click this file. It does not use the editor terminal,
rem  so it works even when the editor terminal is stuck.
rem  Stop the server: close this window or press Ctrl+C.
rem ============================================================
chcp 65001 >nul
setlocal
title Dev server - Centr razuma (local)
cd /d "%~dp0"
set VITE=node_modules\.bin\vite.cmd

if not exist "%VITE%" (
  echo.
  echo ERROR: node_modules is missing. Run: npm install
  echo.
  pause
  exit /b 1
)

echo.
echo ==========================================
echo  Dev server starting.
echo  The exact URL is printed below.
echo  Usually: http://localhost:5173/preview/
echo  Stop: close this window or press Ctrl+C.
echo ==========================================
echo.
call "%VITE%"
echo.
echo Server stopped.
pause
