$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$southUrl = "file:///" + ($PSScriptRoot.Replace('\', '/') + "/south.html")
$guid = [System.Guid]::NewGuid().ToString("N")
$outFile = Join-Path $PSScriptRoot "south_dom_$guid.html"

Start-Process -FilePath $edge -ArgumentList "--headless=new", "--dump-dom", $southUrl -RedirectStandardOutput $outFile -NoNewWindow -Wait

$dom = Get-Content $outFile -Raw -Encoding UTF8
Write-Host ("DOM Length: " + $dom.Length)
Write-Host ("Has 'PT<br>2' or 'PT 2': " + ($dom.Contains('PT<br>2') -or $dom.Contains('PT 2')))
Write-Host ("Has 'PT<br>3' or 'PT 3': " + ($dom.Contains('PT<br>3') -or $dom.Contains('PT 3')))
Write-Host ("Has 'OT<br>2' or 'OT 2': " + ($dom.Contains('OT<br>2') -or $dom.Contains('OT 2')))
Write-Host ("Has 'OT<br>3' or 'OT 3': " + ($dom.Contains('OT<br>3') -or $dom.Contains('OT 3')))
Write-Host ("Has data-section='PT 2': " + $dom.Contains('data-section="PT 2"'))
Write-Host ("Has data-section='PT 3': " + $dom.Contains('data-section="PT 3"'))
