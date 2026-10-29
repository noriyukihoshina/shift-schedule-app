$scriptDir = $PSScriptRoot
$solverJsPath = Join-Path $scriptDir "solver.js"
$c = [System.IO.File]::ReadAllText($solverJsPath, [System.Text.Encoding]::UTF8)
$lines = $c -split "`r?`n"

for ($i = 0; $i -lt $lines.Length; $i++) {
    $line = $lines[$i]
    if ($line.Contains("assignSpecialDutiesToGrid") -or $line.Contains("南2遅番") -or $line.Contains("南2") -or $line.Contains("南3")) {
        Write-Output "$($i+1): $line"
    }
}
