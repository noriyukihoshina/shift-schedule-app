$chromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
$tempHtml = Join-Path $PSScriptRoot "test_south_early_check.html"
$logFile = Join-Path $PSScriptRoot "test_south_early_check.log"

& $chromePath --headless --disable-gpu --enable-logging=stderr --v=1 --virtual-time-budget=5000 "file:///$($tempHtml.Replace('\', '/'))" 2>&1 | Out-File $logFile -Encoding UTF8

Get-Content $logFile | Select-String -Pattern "TEST|OVERALL|VALIDATION"
