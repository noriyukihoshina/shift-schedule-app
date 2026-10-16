$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$here = $PSScriptRoot
if (-not $here) { $here = (Get-Item "勤務表作成").FullName }

$testHtml = Join-Path $here "test_saved_terms_and_holiday.html"
$testUri = [System.Uri]::new($testHtml).AbsoluteUri
$dumpFile = Join-Path $env:TEMP ("dump_" + [System.Guid]::NewGuid().ToString() + ".txt")
$tempDir = Join-Path $env:TEMP ("edge_test_" + [System.Guid]::NewGuid().ToString())

$argList = @(
    "--headless",
    "--disable-gpu",
    "--disable-web-security",
    "--user-data-dir=$tempDir",
    "--virtual-time-budget=8000",
    "--dump-dom",
    $testUri
)

$process = Start-Process -FilePath $edgePath -ArgumentList $argList -NoNewWindow -PassThru -RedirectStandardOutput $dumpFile
$process.WaitForExit(15000)

if (Test-Path $dumpFile) {
    $content = Get-Content $dumpFile -Raw
    if ($content -match 'ALL_PASSED') {
        Write-Host "=== TEST RESULT: ALL PASSED ===" -ForegroundColor Green
        if ($content -match '<div id="test-output">([\s\S]*?)</div>') {
            Write-Host ($matches[1] -replace '<br>', "`n" -replace '&lt;', '<' -replace '&gt;', '>' -replace '&amp;', '&')
        }
    } else {
        Write-Host "=== TEST RESULT: FAILED ===" -ForegroundColor Red
        if ($content -match '<div id="test-output">([\s\S]*?)</div>') {
            Write-Host ($matches[1] -replace '<br>', "`n" -replace '&lt;', '<' -replace '&gt;', '>' -replace '&amp;', '&')
        } else {
            Write-Host $content
        }
    }
} else {
    Write-Host "Dump file not generated." -ForegroundColor Red
}
