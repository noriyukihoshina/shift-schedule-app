$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}
$htmlPath = (Get-Item "test_all_features.html").FullName
$uri = [System.Uri]::new($htmlPath).AbsoluteUri
$outFile = "test_all_features_out.txt"

cmd.exe /c "`"$edgePath`" --headless --disable-gpu --virtual-time-budget=12000 --dump-dom `"$uri`" > `"$outFile`""

Get-Content $outFile | Select-String -Pattern "ALL_SYSTEM_FEATURES_VERIFIED_SUCCESSFULLY|FAILED|PASS"
