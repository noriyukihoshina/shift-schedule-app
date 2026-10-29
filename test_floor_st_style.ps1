$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) {
    $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}
$dir = $PSScriptRoot
$url = "file:///" + ($dir.Replace('\', '/') + "/3f.html")
$log = Join-Path $dir ("test_3f_st_" + [System.Guid]::NewGuid().ToString("N") + ".log")

$p = Start-Process -FilePath $edge -ArgumentList "--headless=new", "--enable-logging=stderr", "--v=1", $url -RedirectStandardError $log -NoNewWindow -PassThru
Start-Sleep -Seconds 5
if (-not $p.HasExited) {
    Stop-Process -Id $p.Id -Force
}
Start-Sleep -Milliseconds 500

if (Test-Path $log) {
    $content = Get-Content $log -Encoding UTF8
    $content | Where-Object { $_ -match "Error|SyntaxError|ReferenceError|TypeError" -and $_ -notmatch "chrome-extension" }
}
