@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Cap Nhat Phan Mem Tu GitHub - Shopee Video Manager SPsign
cd /d "%~dp0"

set "REPO_URL=https://github.com/thincole/PostSPSign.git"
set "ZIP_URL=https://github.com/thincole/PostSPSign/archive/refs/heads/main.zip"

echo ============================================================
echo        CAP NHAT PHAN MEM TU GITHUB
echo        Nguon: https://github.com/thincole/PostSPSign
echo ============================================================
echo.

set "OLD_VER=Chua xac dinh (Ban cu)"
if exist "VERSION" (
    set /p OLD_VER=<VERSION
)
echo [INFO] Phien ban hien tai tren may: !OLD_VER!
echo.

:: 1. Sao luu cau hinh ca nhan (.env, .machine_id, adb_selected_devices.json, day-code-github.bat)
set "BACKUP_DIR=%TEMP%\postspsign_backup_%RANDOM%"
mkdir "%BACKUP_DIR%" >nul 2>&1
if exist ".env" copy /y ".env" "%BACKUP_DIR%\.env" >nul
if exist ".machine_id" copy /y ".machine_id" "%BACKUP_DIR%\.machine_id" >nul
if exist "src\database\adb_selected_devices.json" copy /y "src\database\adb_selected_devices.json" "%BACKUP_DIR%\adb_selected_devices.json" >nul
if exist "day-code-github.bat" copy /y "day-code-github.bat" "%BACKUP_DIR%\day-code-github.bat" >nul

:: 2. Kiem tra Git de cap nhat (neu khong co Git hoac loi thi dung PowerShell tai ZIP)
git --version >nul 2>&1
if not errorlevel 1 (
    echo [1/3] Dang ket noi GitHub qua Git...
    if not exist ".git" (
        git init >nul
        git branch -M main >nul 2>&1
        git remote add origin "%REPO_URL%" >nul 2>&1
    ) else (
        git remote get-url origin >nul 2>&1
        if errorlevel 1 (
            git remote add origin "%REPO_URL%" >nul 2>&1
        ) else (
            git remote set-url origin "%REPO_URL%" >nul 2>&1
        )
    )

    echo [2/3] Dang tai ban cap nhat moi nhat tu GitHub...
    git fetch origin main
    if errorlevel 1 (
        echo [CANH BAO] Git fetch that bai, chuyen sang tai ZIP qua PowerShell...
        goto :fallback_zip
    )
    git reset --hard origin/main
    if errorlevel 1 (
        echo [CANH BAO] Git reset that bai, chuyen sang tai ZIP qua PowerShell...
        goto :fallback_zip
    )
    goto :after_download
)

:fallback_zip
echo [1/3] Dang tai ban cap nhat truc tiep qua PowerShell...
echo [2/3] Dang giai nen va cap nhat ma nguon ^(Giu nguyen Database ^& Luong^)...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; " ^
    "$ProgressPreference = 'SilentlyContinue'; " ^
    "$ErrorActionPreference = 'Stop'; " ^
    "$zip = Join-Path $env:TEMP 'postspsign_update.zip'; " ^
    "$ext = Join-Path $env:TEMP 'postspsign_extract'; " ^
    "if (Test-Path $zip) { Remove-Item $zip -Force }; " ^
    "if (Test-Path $ext) { Remove-Item $ext -Recurse -Force }; " ^
    "Invoke-WebRequest -Uri '%ZIP_URL%' -OutFile $zip -UseBasicParsing; " ^
    "Expand-Archive -LiteralPath $zip -DestinationPath $ext -Force; " ^
    "$inner = Get-ChildItem -Path $ext -Directory | Select-Object -First 1; " ^
    "$exclude = @('node.exe','bin','day-code-github.bat','.env','.machine_id','database.sqlite','database.sqlite-shm','database.sqlite-wal','uploads','cookie_shopee','node_modules','.git'); " ^
    "Get-ChildItem -Path $inner.FullName -Force | ForEach-Object { if ($exclude -notcontains $_.Name) { Copy-Item -Path $_.FullName -Destination (Get-Location) -Recurse -Force } }; " ^
    "Remove-Item $zip -Force -ErrorAction SilentlyContinue; " ^
    "Remove-Item $ext -Recurse -Force -ErrorAction SilentlyContinue"
if errorlevel 1 (
    echo [LOI] Tai ban cap nhat tu GitHub that bai! Vui long kiem tra mang Internet.
    goto :restore_and_fail
)

:after_download
echo [3/3] Dang khoi phuc cau hinh va kiem tra thu vien ^(node_modules^)...
if exist "%BACKUP_DIR%\.env" copy /y "%BACKUP_DIR%\.env" ".env" >nul
if exist "%BACKUP_DIR%\.machine_id" copy /y "%BACKUP_DIR%\.machine_id" ".machine_id" >nul
if exist "%BACKUP_DIR%\adb_selected_devices.json" copy /y "%BACKUP_DIR%\adb_selected_devices.json" "src\database\adb_selected_devices.json" >nul
if exist "%BACKUP_DIR%\day-code-github.bat" copy /y "%BACKUP_DIR%\day-code-github.bat" "day-code-github.bat" >nul
rmdir /s /q "%BACKUP_DIR%" >nul 2>&1

if not exist "node_modules\dotenv" (
    echo [INFO] May moi chua co thu vien node_modules. Dang tu dong cai dat npm install...
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        call npm install --legacy-peer-deps --no-audit --no-fund
    )
)

set "NEW_VER=Chua xac dinh"
if exist "VERSION" (
    set /p NEW_VER=<VERSION
)

echo.
echo ============================================================
echo   CAP NHAT HOAN TAT THANH CONG!
echo   Phien ban truoc : !OLD_VER!
echo   Phien ban moi   : !NEW_VER!
echo   ^(Vui long tat va bat lai start.bat de ap dung code moi^)
echo ============================================================
if /i not "%~1"=="--no-pause" pause
exit /b 0

:restore_and_fail
if exist "%BACKUP_DIR%\.env" copy /y "%BACKUP_DIR%\.env" ".env" >nul
if exist "%BACKUP_DIR%\.machine_id" copy /y "%BACKUP_DIR%\.machine_id" ".machine_id" >nul
if exist "%BACKUP_DIR%\adb_selected_devices.json" copy /y "%BACKUP_DIR%\adb_selected_devices.json" "src\database\adb_selected_devices.json" >nul
if exist "%BACKUP_DIR%\day-code-github.bat" copy /y "%BACKUP_DIR%\day-code-github.bat" "day-code-github.bat" >nul
rmdir /s /q "%BACKUP_DIR%" >nul 2>&1
if /i not "%~1"=="--no-pause" pause
exit /b 1
