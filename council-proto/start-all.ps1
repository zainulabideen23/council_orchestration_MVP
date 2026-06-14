$root = Split-Path -Parent $PSCommandPath

Write-Host "`n========================================"
Write-Host " Council Orchestration Console — Start"
Write-Host "========================================"

Write-Host "[1/3] Starting Node.js API (port 3001)..."
$p1 = Start-Process -NoNewWindow -FilePath "node" -ArgumentList "src/index.js" -WorkingDirectory "$root\server" -PassThru
Start-Sleep -Seconds 2

Write-Host "[2/3] Starting Python Orchestrator (port 8001)..."
$p2 = Start-Process -NoNewWindow -FilePath ".\venv\Scripts\python" -ArgumentList "-m uvicorn main:app --port 8001 --host 0.0.0.0" -WorkingDirectory "$root\orchestrator" -PassThru
Start-Sleep -Seconds 3

Write-Host "[3/3] Starting Vite Frontend (port 5173)..."
$p3 = Start-Process -NoNewWindow -FilePath "npm" -ArgumentList "run dev" -WorkingDirectory "$root\client" -PassThru
Start-Sleep -Seconds 2

Write-Host "`nAll services started. Press Ctrl+C in this window to stop all."
Write-Host "  API     : http://localhost:3001"
Write-Host "  Vite    : http://localhost:5173"
Write-Host "  Orcher  : http://localhost:8001`n"

try {
    Wait-Process -Id $p1.Id, $p2.Id, $p3.Id
} finally {
    Stop-Process -Id $p1.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id $p2.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id $p3.Id -Force -ErrorAction SilentlyContinue
}
