$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$url = "file:///" + ($PSScriptRoot.Replace('\', '/') + "/test_master_detail.html")
$guid = [System.Guid]::NewGuid().ToString("N")
$outFile = Join-Path $PSScriptRoot "res_test_master_$guid.html"

Start-Process -FilePath $edge -ArgumentList "--headless=new", "--virtual-time-budget=5000", "--dump-dom", $url -RedirectStandardOutput $outFile -NoNewWindow -Wait

$dom = [System.IO.File]::ReadAllText($outFile, [System.Text.Encoding]::UTF8)
if ($dom -match '(?s)<div id="testRes"><pre>(.*?)</pre></div>') {
    Write-Host $matches[1]
} else {
    Write-Host "DOM length: " $dom.Length
}
