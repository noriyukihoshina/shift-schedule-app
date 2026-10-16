$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}
$here = $PSScriptRoot
if (-not $here) { $here = (Get-Item "勤務表作成").FullName }

$htmlPath = Join-Path $here "test_term_storage.html"
$uri = [System.Uri]::new($htmlPath).AbsoluteUri
$outFile = Join-Path $here "test_term_storage_out.txt"

cmd.exe /c "`"$edgePath`" --headless --disable-gpu --virtual-time-budget=15000 --dump-dom `"$uri`" > `"$outFile`""

if (Test-Path $outFile) {
    $raw = Get-Content $outFile -Raw -Encoding UTF8
    if ($raw -match '<div id="testLogs">([\s\S]*?)</div>') {
        Write-Host "=== TEST LOGS ==="
        Write-Host $matches[1]
    }
    if ($raw -match 'ALL_TESTS_PASSED') {
        Write-Host ">>> RESULT: SUCCESS (ALL_TESTS_PASSED)" -ForegroundColor Green
    } elseif ($raw -match 'TEST_FAILED') {
        Write-Host ">>> RESULT: FAILED" -ForegroundColor Red
    } else {
        Write-Host ">>> RESULT: UNKNOWN" -ForegroundColor Yellow
    }
} else {
    Write-Host "Output file not found."
}
