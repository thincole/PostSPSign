@echo off
title Shopee Video Uploader
cd /d "%~dp0"
if not exist .env copy .env.example .env

:loop
echo [%date% %time%] Khoi dong Shopee Video Uploader...
node.exe src\start.js
echo.
echo [CANH BAO] Server da bi ngat hoac thoat. Tu dong khoi dong lai sau 3 giay...
timeout /t 3 /nobreak > nul
goto loop
