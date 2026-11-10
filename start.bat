@echo off
chcp 65001 >nul
title Shopee Video Uploader
cd /d "%~dp0"
if not exist .env copy .env.example .env

:: Tu dong cai dat thu vien node_modules neu tai code moi tu GitHub ve ma chua co node_modules
if not exist "node_modules\dotenv" (
    echo [INFO] Phat hien may moi chua cai thu vien ^(node_modules^). Dang tu dong cai dat...
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo [CANH BAO] npm install gap loi, dang thu lai voi --legacy-peer-deps...
        call npm install --legacy-peer-deps --no-audit --no-fund
    )
)

set "NODE_BIN=node"
if exist "node.exe" set "NODE_BIN=node.exe"

:loop
echo [%date% %time%] Khoi dong Shopee Video Uploader...
"%NODE_BIN%" src\start.js
echo.
echo [CANH BAO] Server da bi ngat hoac thoat. Tu dong khoi dong lai sau 3 giay...
timeout /t 3 /nobreak > nul
goto loop
