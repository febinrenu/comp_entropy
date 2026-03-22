@echo off
echo ============================================
echo   Computational Entropy Research Platform
echo   Setup Script for Windows
echo ============================================
echo.

REM Check Python
echo [1/5] Checking Python installation...
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found. Please install Python 3.9+ from python.org
    exit /b 1
)
echo       Python found!

REM Check Node.js
echo [2/5] Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found. Please install Node.js 18+ from nodejs.org
    exit /b 1
)
echo       Node.js found!

REM Setup Backend
echo.
echo [3/5] Setting up Backend (Python/FastAPI)...
cd backend
if not exist "venv" (
    echo       Creating virtual environment...
    python -m venv venv
)
echo       Activating virtual environment...
call venv\Scripts\activate.bat
echo       Installing Python dependencies...
pip install -r requirements.txt -q
cd ..
echo       Backend setup complete!

REM Setup Frontend
echo.
echo [4/5] Setting up Frontend (React)...
cd frontend
echo       Installing Node.js dependencies...
call npm install --silent
cd ..
echo       Frontend setup complete!

REM Create models directory
echo.
echo [5/5] Creating directories...
if not exist "backend\models" mkdir backend\models
if not exist "backend\data" mkdir backend\data
echo       Directories created!

echo.
echo ============================================
echo   Setup Complete!
echo ============================================
echo.
echo To run the application:
echo   1. Start backend:  run_backend.bat
echo   2. Start frontend: run_frontend.bat
echo.
echo Or run both:        run_all.bat
echo.
pause
