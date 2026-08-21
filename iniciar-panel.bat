@echo off
cd /d "%~dp0"

echo Iniciando el Sistema de Confeccion de Informes de Gestion...
start "Panel Informes de Gestion - servidor" cmd /k npm run dev

timeout /t 5 /nobreak >nul
start "" http://localhost:3000
