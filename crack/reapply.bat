@echo off
chcp 65001 >nul
title Reapply license patch
cd /d "%~dp0.."

set "SRC=%~dp0license.service.js"
set "DST=%~dp0..\src\services\license.service.js"

echo [*] Source : %SRC%
echo [*] Target : %DST%

if not exist "%SRC%" (
    echo [X] crack\license.service.js khong ton tai.
    pause
    exit /b 1
)

if exist "%DST%" (
    if not exist "%~dp0backup" mkdir "%~dp0backup"
    copy /y "%DST%" "%~dp0backup\license.service.js.orig" >nul
)

copy /y "%SRC%" "%DST%" >nul
if errorlevel 1 (
    echo [X] Copy that bai. Dang chay tool? Tat tool roi chay lai.
    pause
    exit /b 1
)

echo [OK] Da ap lai patch license.
echo [i] Kiem tra nhanh: node crack\verify.js
pause
