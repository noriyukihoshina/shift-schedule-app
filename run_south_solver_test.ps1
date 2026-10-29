$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$dir = $PSScriptRoot
$url = "file:///" + ($dir.Replace('\', '/') + "/test_south_special_solver.html")
$log = Join-Path $dir "south_test_out.log"

$p = Start-Process -FilePath $edge -ArgumentList "--headless=new", "--enable-logging=stderr", "--v=1", $url -RedirectStandardError $log -NoNewWindow -PassThru
Start-Sleep -Seconds 6
if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force }
Start-Sleep -Milliseconds 500

if (Test-Path $log) {
    Get-Content $log -Encoding UTF8 | Where-Object { $_ -match "CONSOLE" }
} else {
    Write-Host "Log not found"
}
