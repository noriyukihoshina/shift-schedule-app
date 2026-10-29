$scriptDir = $PSScriptRoot
$appJsPath = Join-Path $scriptDir "app.js"
$c = [System.IO.File]::ReadAllText($appJsPath, [System.Text.Encoding]::UTF8)
$lines = $c -split "`r?`n"

for ($i = 0; $i -lt $lines.Length; $i++) {
    $line = $lines[$i]
    if ($line.Contains("assignSpecialDutiesToGrid")) {
        Write-Output "$($i+1): $line"
    }
}
