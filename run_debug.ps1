$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}
$htmlPath = (Get-Item "debug_site.html").FullName
$uri = [System.Uri]::new($htmlPath).AbsoluteUri
$outFile = "debug_site_out.txt"

cmd.exe /c "`"$edgePath`" --headless --disable-gpu --virtual-time-budget=10000 --dump-dom `"$uri`" > `"$outFile`""

Get-Content $outFile -Raw
