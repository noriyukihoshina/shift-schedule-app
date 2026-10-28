Set-Location $PSScriptRoot
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) {
    $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
}
$tempUserDir = Join-Path $PSScriptRoot "temp_edge_user_rev63"
$testHtml = 'file:///' + ((Join-Path (Get-Location).Path 'test_rev63_comprehensive.html') -replace '\\', '/')
Start-Process -FilePath $edge -ArgumentList '--headless=new', "--user-data-dir=$tempUserDir", '--allow-file-access-from-files', '--virtual-time-budget=8000', '--dump-dom', $testHtml -RedirectStandardOutput 'test_rev63_out.txt' -Wait

$content = [System.IO.File]::ReadAllText((Join-Path $PSScriptRoot 'test_rev63_out.txt'), [System.Text.Encoding]::UTF8)
Write-Host "--- TEST OUTPUT ---"
Write-Host $content
