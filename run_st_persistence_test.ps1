$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) { $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }

$p = Join-Path $dir "test_st_persistence.html"
$out = Join-Path $dir "test_st_persistence_out.txt"

$proc = Start-Process -FilePath $edge -ArgumentList "--headless", "--disable-gpu", "--allow-file-access-from-files", "--virtual-time-budget=8000", "--dump-dom", "`"file:///$p`"" -NoNewWindow -PassThru -RedirectStandardOutput $out
if ($proc) {
    $proc.WaitForExit(12000)
} else {
    Start-Sleep -Seconds 6
}

$content = [System.IO.File]::ReadAllText($out, [System.Text.Encoding]::UTF8)
if ($content -match '<div id="test_status">([^<]+)</div>\s*<div id="test_result">([^<]+)</div>') {
    Write-Host "STATUS: $($Matches[1])"
    Write-Host "RESULT: $($Matches[2])"
} else {
    Write-Host "Raw output excerpt:"
    $content -split "`n" | Select-Object -First 25 | ForEach-Object { Write-Host $_ }
}
