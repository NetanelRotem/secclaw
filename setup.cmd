@echo off
rem One-shot install for Windows: dependencies, build, interactive setup.
cd /d "%~dp0"
where node >nul 2>&1 || (echo Node.js 22+ is required: https://nodejs.org & exit /b 1)
call npm ci || exit /b 1
call npm run build || exit /b 1
node dist\setup.js
