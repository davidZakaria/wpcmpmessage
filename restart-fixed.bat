@echo off
echo 🛑 Stopping all Node.js processes to clear the infinite loop...
taskkill /f /im node.exe 2>nul

echo ⏳ Waiting for processes to fully stop...
timeout /t 2 /nobreak >nul

echo 🚀 Starting backend server (with reduced WebSocket frequency)...
start "Backend Server - Fixed" cmd /k "cd /d %~dp0 && echo Backend server starting with WebSocket fixes... && node server.js"

echo ⏳ Waiting for backend to initialize...
timeout /t 3 /nobreak >nul

echo 🌐 Starting frontend (with loop prevention fixes)...
start "Frontend Dev Server - Fixed" cmd /k "cd /d %~dp0 && echo Frontend starting with infinite loop fixes... && npm run dev"

echo ✅ Servers restarted with fixes!
echo.
echo 🔧 FIXES APPLIED:
echo   - Reduced WebSocket update frequency (60s instead of 30s)
echo   - Added loop prevention in SocialChatTab
echo   - Memoized connected platforms to prevent unnecessary re-renders
echo.
echo 📊 Backend: http://localhost:3002
echo 🔗 WebSocket: ws://localhost:3002/ws (reduced frequency)
echo 🌐 Frontend: http://localhost:3001
echo.
echo The infinite loop should now be fixed! 🎉
pause

