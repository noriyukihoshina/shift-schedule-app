$scriptDir = $PSScriptRoot
$files = @("solver.js", "app.js")
foreach ($f in $files) {
    $p = Join-Path $scriptDir $f
    $c = [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)
    $lines = $c -split "`r?`n"
    for ($i = 0; $i -lt $lines.Length; $i++) {
        $line = $lines[$i]
        if ($line.Contains("南2") -or $line.Contains("南3") -or $line.Contains("特殊勤務の候補者不足")) {
            Write-Output "$f ($($i+1)): $line"
        }
    }
}
