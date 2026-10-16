$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$testHtml = Join-Path $PSScriptRoot "test_ui_unification.html"
$testUri = [System.Uri]::new($testHtml).AbsoluteUri
$dumpFile = Join-Path $PSScriptRoot "test_ui_unification_dump.txt"

# Run headless Edge to render and execute tests
$tempDir = Join-Path $env:TEMP "edge_ui_test"
$argList = @(
    "--headless",
    "--disable-gpu",
    "--disable-web-security",
    "--user-data-dir=$tempDir",
    "--virtual-time-budget=6000",
    "--dump-dom",
    $testUri
)

$process = Start-Process -FilePath $edgePath -ArgumentList $argList -NoNewWindow -PassThru -RedirectStandardOutput $dumpFile
$process.WaitForExit(10000)

if (Test-Path $dumpFile) {
    $content = Get-Content $dumpFile -Raw
    if ($content -match 'ALL_PASSED') {
        Write-Host "=== TEST RESULT: ALL PASSED ===" -ForegroundColor Green
        if ($content -match '<div id="test-output">([\s\S]*?)</div>') {
            Write-Host $matches[1]
        }
    } else {
        Write-Host "=== TEST RESULT: FAILED ===" -ForegroundColor Red
        if ($content -match '<div id="test-output">([\s\S]*?)</div>') {
            Write-Host $matches[1]
        } else {
            Write-Host $content
        }
    }
} else {
    Write-Host "Dump file not generated." -ForegroundColor Red
}
