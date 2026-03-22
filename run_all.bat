@echo off
echo ============================================
echo   Starting Computational Entropy Platform
echo ============================================
echo.

REM Start backend in new window
echo Starting Backend...
start "Backend Server" cmd /k "cd /d %~dp0 && run_backend.bat"

REM Wait for backend to start
timeout /t 3 /nobreak >nul

REM Start frontend in new window
echo Starting Frontend...
start "Frontend Server" cmd /k "cd /d %~dp0 && run_frontend.bat"

echo.
echo ============================================
echo   Servers Starting...
echo ============================================
echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:3000
echo API Docs: http://localhost:8000/docs
echo.
echo Close the terminal windows to stop servers.
echo.
pause
