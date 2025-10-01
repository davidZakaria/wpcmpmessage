@echo off
echo 🔄 Installing WebSocket dependencies...
npm install ws@^8.14.2

echo 🛑 Stopping existing server processes...
taskkill /f /im node.exe 2>nul

echo 🚀 Starting server with WebSocket support...
start "Backend Server" cmd /k "cd /d %~dp0 && node server.js"

echo ⏳ Waiting for server to start...
timeout /t 3 /nobreak >nul

echo 🌐 Starting frontend...
start "Frontend Dev Server" cmd /k "cd /d %~dp0 && npm run dev"

echo ✅ Both servers are starting up!
echo 📊 Backend: http://localhost:3002
echo 🔗 WebSocket: ws://localhost:3002/ws
echo 🌐 Frontend: http://localhost:3001
echo.
echo Press any key to close this window...
pause >nul
