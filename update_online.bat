@echo off
chcp 65001 > nul
title Cap Nhat Shopee Video Manager Tu GitHub
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0update_online.ps1"

if %errorlevel% neq 0 (
    echo.
    echo =======================================================
    echo    [!] CAP NHAT THAT BAI!
    echo    Vui long kiem tra lai ket noi Internet va thu lai.
    echo =======================================================
)

echo.
pause
