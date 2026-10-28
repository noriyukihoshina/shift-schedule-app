$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$p = Join-Path $dir "app.js"
$raw = [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)
$lf = $raw.Replace("`r`n", "`n")
[System.IO.File]::WriteAllText($p, $lf, [System.Text.Encoding]::UTF8)
Write-Output "Successfully converted app.js to LF! Length: $($lf.Length)"
