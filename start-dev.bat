@echo off
echo.
echo ======================================
echo    🚀 Starting Expense Tracker App
echo ======================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Display Node.js version
echo 📦 Node.js version:
node --version
echo.

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ Error: package.json not found
    echo Please run this script from the project root directory
    pause
    exit /b 1
)

REM Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo 📥 Installing root dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo ❌ Failed to install root dependencies
        pause
        exit /b 1
    )
)

echo ✅ Dependencies are ready!
echo.
echo 🌟 Starting Express server...
echo.
echo 📋 What's happening:
echo   • Server: http://localhost:5000 (with nodemon hot-reload)
echo   • Database: Auto-connecting to Railway PostgreSQL
echo   • API endpoints: Available at /api/*
echo   • Health check: http://localhost:5000/health
echo.
echo 💡 Tips:
echo   • Server will restart automatically on file changes
echo   • Press Ctrl+C in the server window to stop
echo   • Check logs for database connection status
echo.
echo ======================================
echo.

REM Check if .env file exists
if not exist ".env" (
    echo ⚠️  Warning: .env file not found
    echo Creating .env file from .env.example...
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo ✅ .env file created from .env.example
    ) else (
        echo ❌ No .env.example found. Please create .env manually.
    )
    echo.
)

REM Start server with nodemon for development
echo 🚀 Starting Express server with hot-reload...
echo.
npx nodemon server/index.js

echo.
echo ✅ Express server started successfully!
echo ✅ Server: http://localhost:5000
echo ✅ Health check: http://localhost:5000/health
echo ✅ API documentation available in server/index.js
echo.
pause