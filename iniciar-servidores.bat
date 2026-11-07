@echo off
title Steam Reviews Dashboard - Servidores
echo ====================================================
echo  Iniciando Servidores do Steam Reviews Dashboard
echo ====================================================
echo.
echo 1. Iniciando Backend (FastAPI na porta 8000)...
start "Backend (FastAPI)" cmd /k "cd /d C:\Projects\game-review-dashboard && .venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000"

echo 2. Iniciando Frontend (Astro na porta 4321)...
start "Frontend (Astro)" cmd /k "cd /d C:\Projects\game-review-dashboard\frontend && npm run dev -- --host 127.0.0.1 --port 4321"

echo.
echo ====================================================
echo  Servidores iniciados com sucesso!
echo  Frontend: http://localhost:4321
echo  Backend:  http://127.0.0.1:8000
echo  Swagger:  http://127.0.0.1:8000/docs
echo ====================================================
echo.
pause
