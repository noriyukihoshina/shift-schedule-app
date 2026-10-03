$content = Get-Content '.\solver.js' -Raw
$open = ($content.ToCharArray() | Where-Object { $_ -eq '{' }).Count
$close = ($content.ToCharArray() | Where-Object { $_ -eq '}' }).Count
Write-Host "Open braces: $open, Close braces: $close"

# 行ごとのブレースのネストレベルを追跡して、不一致の発生行を特定
$lines = Get-Content '.\solver.js'
$level = 0
for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    $o = ($line.ToCharArray() | Where-Object { $_ -eq '{' }).Count
    $c = ($line.ToCharArray() | Where-Object { $_ -eq '}' }).Count
    $level += ($o - $c)
    if ($level -lt 0) {
        Write-Host "Extra close brace at line $($i + 1): $line"
        break
    }
}
Write-Host "Final level: $level"
