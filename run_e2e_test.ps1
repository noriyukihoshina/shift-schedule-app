$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$port = 8096
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

$here = $PSScriptRoot
$runnerPath = Join-Path $here "test_runner_workflow.html"
$fileUri = [System.Uri]::new($runnerPath).AbsoluteUri

$proc = Start-Process -FilePath $edge -ArgumentList "--headless", "--disable-gpu", "`"$fileUri`"" -PassThru -NoNewWindow

$context = $listener.GetContext()
$reader = New-Object System.IO.StreamReader($context.Request.InputStream, [System.Text.Encoding]::UTF8)
$json = $reader.ReadToEnd()
$context.Response.StatusCode = 200
$context.Response.Close()
$listener.Stop()

try { $proc.Kill() } catch {}

Write-Host "=== TEST RESULT RECEIVED ===" -ForegroundColor Green
$json
