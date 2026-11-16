@echo off
chcp 65001 >nul
title 勤務表作成システム - 南病棟
pushd "%~dp0"
if exist "%~dp0system\local_server.ps1" (
    start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -Command "& { & '%~dp0system\local_server.ps1' -TargetPage 'south.html' }"
) else (
    start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -Command "& { & '%~dp0local_server.ps1' -TargetPage 'south.html' }"
)
popd
