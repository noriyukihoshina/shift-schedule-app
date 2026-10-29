$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$indexUrl = "file:///" + ($PSScriptRoot.Replace('\', '/') + "/index.html")
$guid = [System.Guid]::NewGuid().ToString("N")
$outFile = Join-Path $PSScriptRoot "index_dom_$guid.html"

Start-Process -FilePath $edge -ArgumentList "--headless=new", "--dump-dom", $indexUrl -RedirectStandardOutput $outFile -NoNewWindow -Wait

$dom = [System.IO.File]::ReadAllText($outFile, [System.Text.Encoding]::UTF8)
Write-Host ("Index DOM Length: " + $dom.Length)

$term1 = [System.Text.Encoding]::UTF8.GetString([byte[]](0xe9,0x9b,0x86,0xe8,0xa8,0x88)) # 集計
$term2 = [System.Text.Encoding]::UTF8.GetString([byte[]](0xe5,0x87,0xba,0xe5,0x8b,0xa4,0xe4,0xba,0xba,0xe6,0x95,0xb0,0xe5,0x90,0x88,0xe8,0xa8,0x88)) # 出勤人数合計
$term3 = [System.Text.Encoding]::UTF8.GetString([byte[]](0xe5,0xae,0x9f,0xe6,0x95,0xb0,0xe5,0x90,0x88,0xe8,0xa8,0x88)) # 実数合計

Write-Host ("Has term1 (集計): " + $dom.Contains($term1))
Write-Host ("Has term2 (出勤人数合計): " + $dom.Contains($term2))
Write-Host ("Has term3 (実数合計): " + $dom.Contains($term3))
