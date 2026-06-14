@echo off
echo ========================================
echo  Council Orchestration Console — Start
echo ========================================

set ROOT=%~dp0

echo [1/3] Starting Node.js API (port 3001)...
start "Node API" cmd /c "cd /d "%ROOT%server" && node src\index.js"
timeout /t 2 /nobreak >nul

echo [2/3] Starting Python Orchestrator (port 8001)...
start "Orchestrator" cmd /c "cd /d "%ROOT%orchestrator" && .\venv\Scripts\python -m uvicorn main:app --port 8001 --host 0.0.0.0"
timeout /t 3 /nobreak >nul

echo [3/3] Starting Vite Frontend (port 5173)...
start "Frontend" cmd /c "cd /d "%ROOT%client" && npm run dev"
timeout /t 2 /nobreak >nul

echo.
echo All services started. Close each window to stop.
echo   API     : http://localhost:3001
echo   Vite    : http://localhost:5173
echo   Orcher  : http://localhost:8001
echo.
pause
