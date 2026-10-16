$raw = Get-Content "test_prev_term_sync_out.txt" -Raw -Encoding UTF8
if ($raw -match '<div id="testLogs">([\s\S]*?)</div>') {
    Write-Host $matches[1]
}
