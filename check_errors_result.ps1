$raw = Get-Content "check_inline_out.txt" -Raw -Encoding UTF8
if ($raw -match '<div id=''errors''>([\s\S]*?)</div>') {
    Write-Host "ERRORS DIV CONTENT: [" $matches[1] "]"
} else {
    Write-Host "No errors div matched."
}
