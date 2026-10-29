$scriptDir = $PSScriptRoot
$appJsPath = Join-Path $scriptDir "app.js"
$c = [System.IO.File]::ReadAllText($appJsPath, [System.Text.Encoding]::UTF8)
$lines = $c -split "`r?`n"

for ($i = 0; $i -lt $lines.Length; $i++) {
    $line = $lines[$i]
    if ($line.Contains("assignSpecial") -or $line.Contains("autoAssignSpecial") -or $line.Contains("deptId === 'south'") -or $line.Contains("isSouth")) {
        if ($line.Length -gt 120) {
            Write-Output "$($i+1): $($line.Substring(0, 120))..."
        } else {
            Write-Output "$($i+1): $line"
        }
    }
}
