$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) { $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }

$p = Join-Path $dir "test_st_check.html"
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$out = Join-Path $dir "test_st_check_out_$ts.txt"

$proc = Start-Process -FilePath $edge -ArgumentList "--headless", "--disable-gpu", "--allow-file-access-from-files", "--virtual-time-budget=8000", "--dump-dom", "`"file:///$p`"" -NoNewWindow -PassThru -RedirectStandardOutput $out
if ($proc) {
    $proc.WaitForExit(10000)
} else {
    Start-Sleep -Seconds 5
}

if (Test-Path $out) {
    $content = [System.IO.File]::ReadAllText($out, [System.Text.Encoding]::UTF8)
    if ($content -match '<div id="res">([^<]+)</div>') {
        Write-Host "RESULT: $($Matches[1])"
    } else {
        Write-Host "RESULT_NOT_MATCHED"
    }
} else {
    Write-Error "Output file not found."
}
