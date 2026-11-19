@echo off
chcp 65001 >nul
title [SenViet] Admin FE 8082
cd /d "%~dp0"
echo ===================================================
echo [SenViet] Khoi dong Admin Web (Port 8082)
echo ===================================================
call npm run dev
if %errorlevel% neq 0 (
    echo.
    echo [!] Admin FE gap su co khi khoi dong.
)
pause
