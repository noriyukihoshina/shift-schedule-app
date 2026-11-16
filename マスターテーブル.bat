@echo off
chcp 65001 >nul
title 勤務表作成システム - マスターテーブル（全館統合）
cd /d "%~dp0"
start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File "local_server.ps1" -TargetPage "master.html"
