$scriptDir = $PSScriptRoot
$solverJsPath = Join-Path $scriptDir "solver.js"
$c = [System.IO.File]::ReadAllText($solverJsPath, [System.Text.Encoding]::UTF8)
$lines = $c -split "`r?`n"

for ($i = 0; $i -lt $lines.Length; $i++) {
    $line = $lines[$i]
    if ($line.Contains("assignSpecialDuties(")) {
        Write-Output "$($i+1): $line"
    }
}
