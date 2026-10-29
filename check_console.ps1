$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$southUrl = "file:///" + ($PSScriptRoot.Replace('\', '/') + "/south.html")
$guid = [System.Guid]::NewGuid().ToString("N")
$logFile = Join-Path $PSScriptRoot "edge_console_$guid.log"

$p = Start-Process -FilePath $edge -ArgumentList "--headless=new", "--enable-logging=stderr", "--v=1", $southUrl -RedirectStandardError $logFile -NoNewWindow -PassThru
Start-Sleep -Seconds 3
if (-not $p.HasExited) {
    Stop-Process -Id $p.Id -Force
}

$logs = Get-Content $logFile -Raw -Encoding UTF8
Write-Host "Logs length: " + $logs.Length
$errorLines = ($logs -split "`n") | Where-Object { $_ -match "CONSOLE|Uncaught|Error" }
$errorLines | ForEach-Object { Write-Host $_ }
