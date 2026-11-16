@echo off
chcp 65001 >nul
title デスクトップにアイコン作成
pushd "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "& {
    $WshShell = New-Object -ComObject WScript.Shell
    $desktop = [System.Environment]::GetFolderPath('Desktop')
    $rootDir = (Get-Location).Path

    $targets = @(
        @{ Name = '1階病棟'; Bat = '1階病棟.bat'; Ico = 'icons\1階病棟.ico' },
        @{ Name = '2階病棟'; Bat = '2階病棟.bat'; Ico = 'icons\2階病棟.ico' },
        @{ Name = '3階病棟'; Bat = '3階病棟.bat'; Ico = 'icons\3階病棟.ico' },
        @{ Name = '南病棟'; Bat = '南病棟.bat'; Ico = 'icons\南病棟.ico' },
        @{ Name = 'ST病棟'; Bat = 'ST病棟.bat'; Ico = 'icons\ST病棟.ico' },
        @{ Name = '生活期'; Bat = '生活期.bat'; Ico = 'icons\生活期.ico' },
        @{ Name = 'マスターテーブル'; Bat = 'マスターテーブル.bat'; Ico = 'icons\マスターテーブル.ico' }
    )

    foreach ($t in $targets) {
        $lnkPath = Join-Path $desktop ('勤務表 - ' + $t.Name + '.lnk')
        $batPath = Join-Path $rootDir $t.Bat
        $icoPath = Join-Path $rootDir $t.Ico

        $sc = $WshShell.CreateShortcut($lnkPath)
        $sc.TargetPath = 'cmd.exe'
        $sc.Arguments = '/c ' + '""' + $batPath + '""'
        $sc.WorkingDirectory = $rootDir
        $sc.WindowStyle = 7
        if (Test-Path $icoPath) {
            $sc.IconLocation = $icoPath + ',0'
        }
        $sc.Save()
    }
    Write-Host 'デスクトップに勤務表アイコン（全7フロア分）を作成しました！' -ForegroundColor Green
    Start-Sleep -Seconds 2
}"
popd
