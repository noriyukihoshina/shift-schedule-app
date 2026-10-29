$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$out = Join-Path $PSScriptRoot "prod_test.html"
$p = Start-Process -FilePath $edge -ArgumentList "--headless=new", "--dump-dom", "https://shift-schedule-app-ruby.vercel.app/index.html" -NoNewWindow -PassThru -RedirectStandardOutput $out
Start-Sleep -Seconds 4
if (-not $p.HasExited) {
    Stop-Process -Id $p.Id -Force
}
Start-Sleep -Seconds 1
$c = [System.IO.File]::ReadAllText($out, [System.Text.Encoding]::UTF8)
Write-Output "Prod DOM Length: $($c.Length)"
if ($c -match '<title>(.*?)</title>') {
    Write-Output "Title: $($matches[1])"
}
