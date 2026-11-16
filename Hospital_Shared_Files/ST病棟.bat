@echo off
chcp 65001 >nul
title 勤務表作成システム - ST専用テーブル
pushd "%~dp0"
start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -Command "& { & '%~dp0local_server.ps1' -TargetPage 'ST.html' }"
popd
