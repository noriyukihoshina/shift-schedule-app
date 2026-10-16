$solver = Get-Content "solver.js" -Raw -Encoding UTF8
$app = Get-Content "app.js" -Raw -Encoding UTF8

$sb = [System.Text.StringBuilder]::new()
$sb.AppendLine("<!DOCTYPE html><html><head><title>Inline Check</title></head><body><div id='errors'></div><script>") | Out-Null
$sb.AppendLine("window.onerror = function(msg, url, line, col, error) { document.getElementById('errors').innerHTML += '<div>WINDOW ERR: ' + msg + ' at ' + line + ' | ' + (error ? error.stack : '') + '</div>'; };") | Out-Null
$sb.AppendLine("</script><script>") | Out-Null
$sb.AppendLine("try {") | Out-Null
$sb.AppendLine($solver) | Out-Null
$sb.AppendLine("} catch(e) { document.getElementById('errors').innerHTML += '<div>SOLVER ERR: ' + e.stack + '</div>'; }") | Out-Null
$sb.AppendLine("</script><script>") | Out-Null
$sb.AppendLine("try {") | Out-Null
$sb.AppendLine($app) | Out-Null
$sb.AppendLine("} catch(e) { document.getElementById('errors').innerHTML += '<div>APP ERR: ' + e.stack + '</div>'; }") | Out-Null
$sb.AppendLine("</script></body></html>") | Out-Null

[System.IO.File]::WriteAllText((Join-Path (Get-Location).Path "check_inline.html"), $sb.ToString(), [System.Text.Encoding]::UTF8)

$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) { $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }
$htmlPath = (Get-Item "check_inline.html").FullName
$uri = [System.Uri]::new($htmlPath).AbsoluteUri
$outFile = "check_inline_out.txt"

cmd.exe /c "`"$edgePath`" --headless --disable-gpu --virtual-time-budget=5000 --dump-dom `"$uri`" > `"$outFile`""
Get-Content $outFile | Select-String -Pattern "ERR|errors"
