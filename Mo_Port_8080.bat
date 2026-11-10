@echo off
chcp 65001 >nul
title Mo Cong 8080 - PhoneSign Tailscale

:: Kiem tra quyen Administrator, neu chua co thi tu dong yeu cau quyen Admin (UAC)
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] Dang yeu cau quyen Administrator de mo Windows Firewall...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo ============================================================
echo   MO CONG 8080 TREN WINDOWS FIREWALL CHO PHONESIGN TAILSCALE
echo ============================================================
echo.

:: Xoa rule cu (neu da ton tai) de tranh trung lap
powershell -NoProfile -ExecutionPolicy Bypass -Command "Remove-NetFirewallRule -DisplayName 'PhoneSign Tailscale 8080' -ErrorAction SilentlyContinue"

:: Tao rule moi mo cong TCP 8080 Inbound
powershell -NoProfile -ExecutionPolicy Bypass -Command "New-NetFirewallRule -DisplayName 'PhoneSign Tailscale 8080' -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow"

if %errorLevel% equ 0 (
    echo.
    echo [THANH CONG] Da mo cong 8080 tren Windows Firewall!
    echo Cac may tram trong Tailscale co the ket noi toi: http://100.79.170.67:8080
) else (
    echo.
    echo [!] Thu phuong phap du phong qua netsh advfirewall...
    netsh advfirewall firewall add rule name="PhoneSign Tailscale 8080" dir=in action=allow protocol=TCP localport=8080
)

echo.
pause
