$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$dir = $PSScriptRoot
$screens = @("1f.html", "2f.html", "3f.html", "south.html")

foreach ($s in $screens) {
    $url = "file:///" + ($dir.Replace('\', '/') + "/" + $s)
    $logFile = Join-Path $dir ("verify_ha_" + [System.Guid]::NewGuid().ToString("N") + ".log")

    $p = Start-Process -FilePath $edge -ArgumentList "--headless=new", "--enable-logging=stderr", "--v=1", $url -RedirectStandardError $logFile -NoNewWindow -PassThru
    Start-Sleep -Seconds 4
    if (-not $p.HasExited) {
        Stop-Process -Id $p.Id -Force
    }
    Start-Sleep -Seconds 1

    $content = ""
    if (Test-Path $logFile) {
        try {
            $stream = [System.IO.File]::Open($logFile, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
            $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
            $content = $reader.ReadToEnd()
            $reader.Close()
            $stream.Close()
        } catch {}
    }

    Write-Host "Screen: $s" -ForegroundColor Cyan
    $logs = ($content -split "`r?`n") | Where-Object { $_ -match "\[DIAG_" }
    $logs | ForEach-Object { Write-Host "   $_" }
}
