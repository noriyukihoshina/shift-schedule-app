$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) {
    $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
}

$testHtml = "c:\Users\coffe\OneDrive\デスクトップ\Antigravity\勤務表作成\test_saved_terms_and_holiday.html"
$outTxt = "c:\Users\coffe\OneDrive\デスクトップ\Antigravity\勤務表作成\test_saved_terms_and_holiday_out.txt"

# Edge headlessでダンプ
& $edge --headless --disable-gpu --dump-dom $testHtml | Out-File -FilePath $outTxt -Encoding utf8

$content = Get-Content -Path $outTxt -Raw -Encoding utf8
if ($content -match 'ALL_TESTS_PASSED') {
    Write-Host "SUCCESS: ALL TESTS PASSED!"
    if ($content -match '<div id="logs">(.*?)</div>') {
        Write-Host $matches[1]
    }
} else {
    Write-Host "FAILED or NOT FINISHED YET. Dumping logs:"
    if ($content -match '<div id="logs">(.*?)</div>') {
        Write-Host $matches[1]
    } else {
        Write-Host ($content.Substring(0, [Math]::Min(1000, $content.Length)))
    }
}
