@echo off
chcp 65001 >nul
title 勤務表作成システム - 2階病棟
cd /d "%~dp0"
start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File "local_server.ps1" -TargetPage "2f.html"
