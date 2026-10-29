$dir = $PSScriptRoot
$lifeWord = "$([char]0x751F)$([char]0x6D3B)$([char]0x671F)"
$1fWord = "1$([char]0x968E)$([char]0x75C5)$([char]0x68DF)"

# 1. 1f.html -> life.html
$content1f = [System.IO.File]::ReadAllText((Join-Path $dir "1f.html"), [System.Text.Encoding]::UTF8)
$lifeHtml = $content1f
$lifeHtml = $lifeHtml -replace $1fWord, $lifeWord
$lifeHtml = $lifeHtml -replace 'class="theme-1f"', 'class="theme-life"'
$lifeHtml = $lifeHtml -replace "deptId:\s*'1f'", "deptId: 'life'"
$lifeHtml = $lifeHtml -replace "floor:\s*'1F'", "floor: '$lifeWord',`r`n            isLife: true"
$lifeHtml = $lifeHtml -replace "theme:\s*'theme-1f'", "theme: 'theme-life'"

[System.IO.File]::WriteAllText((Join-Path $dir "life.html"), $lifeHtml, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText((Join-Path $dir "$lifeWord.html"), $lifeHtml, [System.Text.Encoding]::UTF8)
Write-Output "Created life.html and $($lifeWord).html"

$targetFiles = @(
    'index.html', "$([char]0x30DE)$([char]0x30B9)$([char]0x30BF)$([char]0x30FC)$([char]0x30C6)$([char]0x30FC)$([char]0x30D6)$([char]0x30EB).html", 'master.html',
    '1f.html', "$([char]0x0031)$([char]0x968E)$([char]0x75C5)$([char]0x68DF).html",
    '2f.html', "$([char]0x0032)$([char]0x968E)$([char]0x75C5)$([char]0x68DF).html",
    '3f.html', "$([char]0x0033)$([char]0x968E)$([char]0x75C5)$([char]0x68DF).html",
    'south.html', "$([char]0x5357)$([char]0x75C5)$([char]0x68DF).html",
    'ST.html',
    'life.html', "$lifeWord.html", "$($lifeWord)_$([char]0x7BA1)$([char]0x7406)$([char]0x8005).html"
)

foreach ($f in $targetFiles) {
    $p = Join-Path $dir $f
    if (Test-Path $p) {
        $c = [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)
        $c = $c -replace 'rev65', 'rev66'
        if (-not ($c -match 'href="life\.html"')) {
            $isLife = ($f -match 'life' -or $f -match $lifeWord)
            $activeCls = if ($isLife) { " active" } else { "" }
            $btn = "`r`n        <a href=""life.html"" class=""dept-nav-btn dept-nav-life$activeCls"" style=""background:#f0fdfa; border-color:#99f6e4; color:#0f766e;"">$lifeWord</a>"
            $c = [System.Text.RegularExpressions.Regex]::Replace($c, '(<a href="ST\.html"[^>]*>[\s\S]*?<\/a>)', "`$1$btn")
        }
        [System.IO.File]::WriteAllText($p, $c, [System.Text.Encoding]::UTF8)
        Write-Output "Updated $f"
    }
}
