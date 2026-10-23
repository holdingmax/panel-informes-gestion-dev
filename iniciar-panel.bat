@echo off
cd /d "%~dp0"

echo Trayendo la base de Render DEV a la base local (si RENDER_DATABASE_URL esta en el .env)...
echo Antes se respalda la de Render y lo que habia en local (carpeta Respaldos).
call npm run db:sincronizar
if errorlevel 1 (
  echo.
  echo ATENCION: no se pudo sincronizar con Render DEV. Se arranca con la base local tal como esta.
  timeout /t 10
)
echo.

echo Iniciando el Sistema de Confeccion de Informes de Gestion...
start "Panel Informes de Gestion - servidor" cmd /k npm run dev

timeout /t 5 /nobreak >nul
start "" http://localhost:3000
