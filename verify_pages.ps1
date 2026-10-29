$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) {
    $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$pages = @("south.html", "1f.html", "ST.html", "index.html")
$baseDir = $PSScriptRoot

foreach ($page in $pages) {
    $fileUrl = "file:///" + ($baseDir.Replace('\', '/') + "/" + $page)
    $output = & $edge --headless=new --dump-dom $fileUrl 2>&1
    $length = ($output | Out-String).Length
    Write-Host "Page: $page, DOM length: $length"
}
