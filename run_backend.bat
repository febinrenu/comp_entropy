@echo off
echo ============================================
echo   Starting Backend Server (FastAPI)
echo ============================================
echo.

cd backend
call venv\Scripts\activate.bat

echo Starting server at http://localhost:8000
echo API docs at http://localhost:8000/docs
echo.
echo Press Ctrl+C to stop the server
echo.

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
