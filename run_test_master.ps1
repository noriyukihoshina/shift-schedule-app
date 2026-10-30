$chromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
$tempHtml = Join-Path $PSScriptRoot "test_master_stats.html"
$logFile = Join-Path $PSScriptRoot "test_master_stats.log"

& $chromePath --headless --disable-gpu --enable-logging=stderr --v=1 --virtual-time-budget=6000 "file:///$($tempHtml.Replace('\', '/'))" 2>&1 | Out-File $logFile -Encoding UTF8

Get-Content $logFile | Select-String -Pattern "MASTER_"
