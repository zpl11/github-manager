@echo off
title GitHub Repo Manager
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found on your system!
    echo Please install Node.js from https://nodejs.org
    echo.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Installing dependencies, please wait a moment...
    call npm install --omit=dev
)

node server.js
if %errorlevel% neq 0 pause
