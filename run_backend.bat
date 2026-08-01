@echo off
echo ============================================
echo   Starting Backend Server (FastAPI)
echo ============================================
echo.

cd backend

if not exist venv\Scripts\activate.bat (
    echo ERROR: backend\venv not found. Run setup.bat first.
    pause
    exit /b 1
)
call venv\Scripts\activate.bat

echo Starting server at http://localhost:8000
echo API docs at http://localhost:8000/docs
echo.
echo Press Ctrl+C to stop the server
echo.

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
