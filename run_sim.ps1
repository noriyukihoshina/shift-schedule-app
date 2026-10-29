$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$url = "file:///" + ($dir.Replace('\', '/') + "/test_south_sim.html")
$log = Join-Path $dir "sim_out.log"

$p = Start-Process -FilePath $edge -ArgumentList "--headless=new", "--enable-logging=stderr", "--v=1", $url -RedirectStandardError $log -NoNewWindow -PassThru
Start-Sleep -Seconds 5
if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force }
Start-Sleep -Milliseconds 500

$content = [System.IO.File]::ReadAllText($log, [System.Text.Encoding]::UTF8)
$content -split "`r?`n" | Where-Object { $_ -match "Base result|Special result|ERRORS|REJECT_REASONS" }
