$scriptDir = $PSScriptRoot
$appJsPath = Join-Path $scriptDir "app.js"
$c = [System.IO.File]::ReadAllText($appJsPath, [System.Text.Encoding]::UTF8)
$lines = $c -split "`r?`n"

for ($i = 0; $i -lt $lines.Length; $i++) {
    $line = $lines[$i]
    if ($line.Contains("loadStaffData") -or $line.Contains("createDefaultStaff") -or $line.Contains("section:") -or $line.Contains("defaultStaff")) {
        Write-Output "$($i+1): $line"
    }
}
