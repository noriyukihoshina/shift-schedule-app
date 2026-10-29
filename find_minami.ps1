$scriptDir = $PSScriptRoot
$minamiChar = [char]0x5357 # 南
$files = @("solver.js", "app.js")
foreach ($f in $files) {
    $p = Join-Path $scriptDir $f
    $c = [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)
    $lines = $c -split "`r?`n"
    for ($i = 0; $i -lt $lines.Length; $i++) {
        $line = $lines[$i]
        if ($line.IndexOf($minamiChar) -ge 0) {
            if ($line.Length -gt 100) {
                Write-Output "$f ($($i+1)): $($line.Substring(0, 100))..."
            } else {
                Write-Output "$f ($($i+1)): $line"
            }
        }
    }
}
