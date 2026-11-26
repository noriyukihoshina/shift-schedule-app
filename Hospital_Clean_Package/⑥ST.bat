@echo off
pushd "%~dp0"
start "" powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File "%~dp0system\server.ps1" -TargetPage ST.html
popd
