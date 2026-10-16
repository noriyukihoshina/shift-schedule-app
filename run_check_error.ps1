$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}
$htmlPath = (Get-Item "check_error.html").FullName
$uri = [System.Uri]::new($htmlPath).AbsoluteUri
$outFile = "check_error_out.txt"

cmd.exe /c "`"$edgePath`" --headless --disable-gpu --virtual-time-budget=5000 --dump-dom `"$uri`" > `"$outFile`""

Get-Content $outFile | Select-String -Pattern "ERROR|completed"
