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

REM Install client dependencies if client/node_modules doesn't exist
if not exist "client\node_modules" (
    echo 📥 Installing client dependencies...
    cd client
    npm install
    if %errorlevel% neq 0 (
        echo ❌ Failed to install client dependencies
        pause
        exit /b 1
    )
    cd ..
)

echo ✅ Dependencies are ready!
echo.
echo 🌟 Starting development servers...
echo.
echo 📋 What's happening:
echo   • Server: http://localhost:5000 (with nodemon hot-reload)
echo   • Client: http://localhost:3000 (with React hot-reload)
echo   • Database: Auto-connecting to configured database
echo.
echo 💡 Tips:
echo   • Both servers will start in separate windows
echo   • Both will restart automatically on file changes
echo   • Close the windows to stop the servers
echo.
echo ======================================
echo.

REM Start server in a new window with nodemon
echo 🚀 Starting server...
start "Expense Tracker - Server" cmd /k "cd /d "%~dp0" && nodemon server/index.js"

REM Wait a moment for server to start
timeout /t 2 /nobreak >nul

REM Start client in a new window
echo 🚀 Starting client...
start "Expense Tracker - Client" cmd /k "cd /d "%~dp0client" && npm start"

echo.
echo ✅ Both servers are starting in separate windows!
echo ✅ Server: http://localhost:5000
echo ✅ Client: http://localhost:3000
echo.
echo � Close the terminal windows to stop the servers
echo.
pause