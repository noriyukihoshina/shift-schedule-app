$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$pages = @("1f.html", "ST.html", "index.html")

foreach ($page in $pages) {
    $url = "file:///" + ($PSScriptRoot.Replace('\', '/') + "/" + $page)
    $guid = [System.Guid]::NewGuid().ToString("N")
    $outFile = Join-Path $PSScriptRoot "verify_$guid.html"
    Start-Process -FilePath $edge -ArgumentList "--headless=new", "--dump-dom", $url -RedirectStandardOutput $outFile -NoNewWindow -Wait
    $dom = Get-Content $outFile -Raw -Encoding UTF8
    Write-Host "$page rendered DOM length: " $dom.Length
}
