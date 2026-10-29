$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$dir = $PSScriptRoot
$screens = @("index.html", "1f.html", "2f.html", "3f.html", "south.html", "ST.html", "life.html")

$allPassed = $true

foreach ($s in $screens) {
    $url = "file:///" + ($dir.Replace('\', '/') + "/" + $s)
    $logFile = Join-Path $dir "verify_out.log"
    if (Test-Path $logFile) {
        # overwrite with empty string
        [System.IO.File]::WriteAllText($logFile, "", [System.Text.Encoding]::UTF8)
    }

    $p = Start-Process -FilePath $edge -ArgumentList "--headless=new", "--enable-logging=stderr", "--v=1", $url -RedirectStandardError $logFile -NoNewWindow -PassThru
    Start-Sleep -Seconds 4
    if (-not $p.HasExited) {
        Stop-Process -Id $p.Id -Force
    }
    Start-Sleep -Milliseconds 500

    $content = [System.IO.File]::ReadAllText($logFile, [System.Text.Encoding]::UTF8)
    $errors = ($content -split "`r?`n") | Where-Object { $_ -match "CONSOLE.*Error|SyntaxError|ReferenceError|TypeError" -and $_ -notmatch "chrome-extension" }

    if ($errors.Count -gt 0) {
        Write-Host "FAILED: $s" -ForegroundColor Red
        $errors | ForEach-Object { Write-Host "   $_" -ForegroundColor Red }
        $allPassed = $false
    } else {
        Write-Host "PASSED: $s (0 errors)" -ForegroundColor Green
    }
}

if ($allPassed) {
    Write-Host "`nALL SCREENS PASSED PERFECTLY!" -ForegroundColor Cyan
} else {
    Write-Host "`nSOME SCREENS FAILED!" -ForegroundColor Red
    exit 1
}
