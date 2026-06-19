@echo off
title CeShark ERP - Iniciando...
color 0A

echo.
echo  ========================================
echo    CeShark ERP Modular - Inicio rapido
echo  ========================================
echo.

REM --- Backend (FastAPI) ---
echo  [1/2] Iniciando Backend (FastAPI en :8000)...
start "Backend FastAPI" cmd /k "cd /d %~dp0 && venv\Scripts\activate && uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"

REM Esperar que FastAPI levante antes de arrancar Vite
timeout /t 3 /nobreak >nul

REM --- Frontend (Vite) ---
echo  [2/2] Iniciando Frontend (Vite en :5173)...
start "Frontend Vite" cmd /k "cd /d %~dp0\frontend\myapp && npm run dev"

REM Esperar que Vite compile antes de abrir el navegador
echo.
echo  Esperando que los servidores inicien (8 segundos)...
timeout /t 8 /nobreak >nul

echo.
echo  Abriendo CeShark ERP en el navegador...
start http://localhost:5173

exit
