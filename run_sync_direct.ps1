$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}
$htmlPath = (Get-Item "test_prev_term_sync_direct.html").FullName
$uri = [System.Uri]::new($htmlPath).AbsoluteUri
$outFile = "test_prev_term_sync_direct_out.txt"

cmd.exe /c "`"$edgePath`" --headless --disable-gpu --virtual-time-budget=8000 --dump-dom `"$uri`" > `"$outFile`""

Get-Content $outFile | Select-String -Pattern "ALL_TESTS_PASSED|FAILED|STEP|4/29"
