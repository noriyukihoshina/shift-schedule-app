@echo off
chcp 65001 >nul
title 勤務表作成システム - 生活期
cd /d "%~dp0"
start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File "local_server.ps1" -TargetPage "life.html"
