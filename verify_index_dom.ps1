$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$url = "file:///" + ($PSScriptRoot.Replace('\', '/') + "/index.html")
$guid = [System.Guid]::NewGuid().ToString("N")
$outFile = Join-Path $PSScriptRoot "res_index_rendered_$guid.html"

Start-Process -FilePath $edge -ArgumentList "--headless=new", "--virtual-time-budget=3000", "--dump-dom", $url -RedirectStandardOutput $outFile -NoNewWindow -Wait

$dom = [System.IO.File]::ReadAllText($outFile, [System.Text.Encoding]::UTF8)

# UTF-8 文字列チェック
function HasTerm($bytes) {
    $str = [System.Text.Encoding]::UTF8.GetString([byte[]]$bytes)
    return $dom.Contains($str)
}

Write-Host ("DOM Length: " + $dom.Length)
Write-Host ("Has '集計': " + (HasTerm @(0xe9,0x9b,0x86,0xe8,0xa8,0x88)))
Write-Host ("Has '出勤人数合計': " + (HasTerm @(0xe5,0x87,0xba,0xe5,0x8b,0xa4,0xe4,0xba,0xba,0xe6,0x95,0xb0,0xe5,0x90,0x88,0xe8,0xa8,0x88)))
Write-Host ("Has '実数合計': " + (HasTerm @(0xe5,0xae,0x9f,0xe6,0x95,0xb0,0xe5,0x90,0x88,0xe8,0xa8,0x88)))
Write-Host ("Has '早': " + (HasTerm @(0xe6,0x97,0xa9)))
Write-Host ("Has '遅': " + (HasTerm @(0xe9,0x81,0x85)))
Write-Host ("Has '8時': " + (HasTerm @(0x38,0xe6,0x99,0x82)))
Write-Host ("Has 'master-detail-row': " + $dom.Contains('master-detail-row'))
