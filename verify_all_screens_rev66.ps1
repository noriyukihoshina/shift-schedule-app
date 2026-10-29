$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$dir = $PSScriptRoot
$screens = @("index.html", "1f.html", "2f.html", "3f.html", "south.html", "ST.html", "life.html")

$allOk = $true

foreach ($screen in $screens) {
    $url = "file:///" + ($dir.Replace('\', '/') + "/" + $screen)
    $guid = [System.Guid]::NewGuid().ToString("N")
    $logFile = Join-Path $dir "edge_console_$guid.log"

    $p = Start-Process -FilePath $edge -ArgumentList "--headless=new", "--enable-logging=stderr", "--v=1", $url -RedirectStandardError $logFile -NoNewWindow -PassThru
    Start-Sleep -Seconds 3
    if (-not $p.HasExited) {
        Stop-Process -Id $p.Id -Force
    }

    $logs = ""
    if (Test-Path $logFile) {
        $logs = [System.IO.File]::ReadAllText($logFile, [System.Text.Encoding]::UTF8)
    }

    $errorLines = ($logs -split "`r?`n") | Where-Object { $_ -match "CONSOLE.*Error|Uncaught SyntaxError|Uncaught ReferenceError|Uncaught TypeError" }
    if ($errorLines.Count -gt 0) {
        Write-Host "[FAIL] $screen has console errors:" -ForegroundColor Red
        $errorLines | ForEach-Object { Write-Host "   $_" -ForegroundColor Red }
        $allOk = $false
    } else {
        Write-Host "[PASS] $screen loaded with 0 console errors." -ForegroundColor Green
    }
}

if ($allOk) {
    Write-Host "`nAll screens passed validation successfully!" -ForegroundColor Cyan
} else {
    Write-Host "`nSome screens failed validation." -ForegroundColor Red
    exit 1
}
