@echo off
setlocal

cd /d "%~dp0"

if not exist node_modules (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 exit /b 1
)

echo Starting Algebuds locally...
echo.
echo Local URL: http://127.0.0.1:5173/algebuds/
echo Press Ctrl+C in this window to stop the server.
echo.

start "" "http://127.0.0.1:5173/algebuds/"
call npm run dev -- --host 127.0.0.1
