param([string]$File = 'test_runner.html')
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$testHtml = Join-Path $here $File
$fileUri = [System.Uri]::new($testHtml).AbsoluteUri

$port = 8089
$prefix = "http://localhost:$port/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()

Write-Output "HttpListener started on $prefix. Opening Edge..."

$edgeProcess = Start-Process -FilePath $edge -ArgumentList "--headless", "--disable-gpu", "`"$fileUri`"" -PassThru -NoNewWindow

$context = $listener.GetContext()
$request = $context.Request
$reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
$resultText = $reader.ReadToEnd()

# レスポンス送信
$response = $context.Response
$response.StatusCode = 200
$buffer = [System.Text.Encoding]::UTF8.GetBytes("OK")
$response.ContentLength64 = $buffer.Length
$response.OutputStream.Write($buffer, 0, $buffer.Length)
$response.OutputStream.Close()

$listener.Stop()
$listener.Close()

try {
    $edgeProcess.Kill()
} catch {}

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Output "--- Test Execution Result ---"
Write-Output $resultText
