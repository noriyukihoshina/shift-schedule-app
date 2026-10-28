Set-Location $PSScriptRoot
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) {
    $edge = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
}
$testHtml = 'file:///' + ((Join-Path (Get-Location).Path 'test_rev63_app_features.html') -replace '\\', '/')
$timestamp = (Get-Date).Ticks
$logFile = Join-Path $PSScriptRoot "test_rev63_app_log_$timestamp.txt"
$p = Start-Process -FilePath $edge -ArgumentList '--headless=new', '--allow-file-access-from-files', '--virtual-time-budget=8000', '--dump-dom', $testHtml -RedirectStandardOutput $logFile -PassThru
$p.WaitForExit()
Start-Sleep -Milliseconds 500

$txt = [System.IO.File]::ReadAllText($logFile, [System.Text.Encoding]::UTF8)
if ($txt -match '<pre[^>]*>([\s\S]*?)<\/pre>') {
    Write-Host "--- TEST LOGS ---"
    Write-Host $matches[1]
} else {
    Write-Host "--- RAW OUTPUT ---"
    Write-Host $txt
}
