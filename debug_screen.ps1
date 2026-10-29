$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$dir = $PSScriptRoot
$url = "file:///" + ($dir.Replace('\', '/') + "/1f.html")
$logFile = Join-Path $dir "debug_1f.log"

$p = Start-Process -FilePath $edge -ArgumentList "--headless=new", "--enable-logging=stderr", "--v=1", $url -RedirectStandardError $logFile -NoNewWindow -PassThru
Start-Sleep -Seconds 5
if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force }

if (Test-Path $logFile) {
    Get-Content $logFile | Where-Object { $_ -match "CONSOLE|Error|Exception" }
}
