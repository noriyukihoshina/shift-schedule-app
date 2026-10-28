$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) { $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }

$guid = [Guid]::NewGuid().ToString("N")
$htmlPath = Join-Path $dir "test_e2e_verification.html"
$outPath = Join-Path $dir ("test_e2e_res_" + $guid + ".txt")

$urlArg = "file:///" + $htmlPath + "?v=" + $guid

$proc = Start-Process -FilePath $edge -ArgumentList "--headless", "--disable-gpu", "--disk-cache-size=0", "--virtual-time-budget=8000", "--dump-dom", "`"$urlArg`"" -NoNewWindow -PassThru -RedirectStandardOutput $outPath
$proc.WaitForExit(10000)

$content = [System.IO.File]::ReadAllText($outPath, [System.Text.Encoding]::UTF8)

Write-Output "--- RESULTS DIV CONTENT ---"
$m = [System.Text.RegularExpressions.Regex]::Match($content, '(?s)<div id="results"[^>]*>(.*?)</div>')
if ($m.Success) {
    Write-Output $m.Groups[1].Value
} else {
    Write-Output "Failed to find results div"
}

Write-Output "`n--- TITLE ---"
[System.Text.RegularExpressions.Regex]::Matches($content, '<title>(.*?)</title>') | ForEach-Object { $_.Value }
