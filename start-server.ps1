Write-Host "Starting WhatsApp Backend Server..." -ForegroundColor Green
Write-Host ""
Write-Host "If you see any errors, please check:" -ForegroundColor Yellow
Write-Host "1. Node.js is installed" -ForegroundColor Yellow
Write-Host "2. All dependencies are installed (npm install)" -ForegroundColor Yellow
Write-Host "3. No other process is using port 3002" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Cyan
Write-Host ""

try {
    node server.js
} catch {
    Write-Host "Error starting server: $_" -ForegroundColor Red
    Write-Host "Press any key to continue..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}
