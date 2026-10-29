Set-Location $PSScriptRoot
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) {
    $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}
$testHtml = "file:///" + ((Join-Path (Get-Location).Path "south.html") -replace '\\', '/')
$resFile = "test_south_dom_" + [guid]::NewGuid().ToString("N") + ".txt"
& $edge --headless=new --allow-file-access-from-files --virtual-time-budget=6000 --dump-dom $testHtml | Out-File -FilePath $resFile -Encoding utf8
Get-Content $resFile | Select-String -Pattern "PT<br>2|PT<br>3|OT<br>2|OT<br>3"
