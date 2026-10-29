$scriptDir = $PSScriptRoot
$files = @("solver.js", "app.js")
foreach ($f in $files) {
    $p = Join-Path $scriptDir $f
    $c = [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)
    $lines = $c -split "`r?`n"
    for ($i = 0; $i -lt $lines.Length; $i++) {
        $line = $lines[$i]
        if ($line.Contains("assignSpecialDutiesToGrid") -or $line.Contains("errors.push") -or $line.Contains("warnings.push") -or $line.Contains("specialErrors") -or $line.Contains("dutyDef") -or $line.Contains("earlyLateDuties")) {
            Write-Output "$f ($($i+1)): $line"
        }
    }
}
