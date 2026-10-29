$c = [System.IO.File]::ReadAllText(".\勤務表作成\app.js", [System.Text.Encoding]::UTF8)
$lines = $c -split "`r?`n"
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match "特殊勤務.*割当" -or $lines[$i] -match "南2" -or $lines[$i] -match "南3") {
        Write-Output "$($i+1): $($lines[$i])"
    }
}
