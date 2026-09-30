@echo off
cd /d "%~dp0"

echo Respaldando el repositorio y la base de datos...
npx tsx prisma/respaldar-todo.ts

echo.
pause
