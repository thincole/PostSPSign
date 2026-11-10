@echo off
chcp 65001 > nul
title Chuyen Country Tat Ca Tai Khoan Sang PH
cd /d "%~dp0"

echo ========================================================
echo   TOOL CHUYEN TAT CA TAI KHOAN SANG QUOC GIA PHILIPPINES (PH)
echo ========================================================
echo.

if exist node.exe (
    node.exe chuyenPH.js
) else (
    node chuyenPH.js
)

echo.
echo ========================================================
echo   Nhan phim bat ky de thoat...
echo ========================================================
pause > nul
