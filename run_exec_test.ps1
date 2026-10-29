$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chromePath)) {
    $chromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
}

$tempHtml = Join-Path $PSScriptRoot "test_headcount_exec.html"
$logFile = Join-Path $PSScriptRoot "test_headcount_exec.log"

& $chromePath --headless --disable-gpu --enable-logging=stderr --v=1 --virtual-time-budget=5000 "file:///$($tempHtml.Replace('\', '/'))" 2>&1 | Out-File $logFile -Encoding UTF8

Get-Content $logFile | Select-String -Pattern "HEADCOUNT|TOTAL_WORK|REAL_WORK|HALF"
