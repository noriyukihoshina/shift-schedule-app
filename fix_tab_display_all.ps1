$dir = Split-Path -Parent $MyInvocation.MyCommand.Path

# 1. style.css の修正
$cssPath = Join-Path $dir "style.css"
$css = [System.IO.File]::ReadAllText($cssPath, [System.Text.Encoding]::UTF8)
$css = $css.Replace("`r`n", "`n")
$css = $css.Replace(".tab-panel.active {`n    display: block;`n}", ".tab-panel.active {`n    display: block !important;`n}")
$css = $css.Replace(".tab-panel.active { display: block; }", ".tab-panel.active { display: block !important; }")
[System.IO.File]::WriteAllText($cssPath, $css, [System.Text.Encoding]::UTF8)
Write-Output "Updated style.css with !important"

# 2. 全 HTML の style="display:none;" 除去 & rev60 キャッシュバスター
$htmlFiles = Get-ChildItem -Path $dir -Filter "*.html" | Where-Object {
    $_.Name -notmatch "^test_" -and $_.Name -notmatch "^_test"
}

foreach ($f in $htmlFiles) {
    $p = $f.FullName
    $html = [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)
    
    # outputTab の inline display:none を削除
    $html = $html.Replace('<section id="outputTab" class="tab-panel" style="display:none;">', '<section id="outputTab" class="tab-panel">')
    $html = $html.Replace('<section id="outputTab" class="tab-panel" style="display: none;">', '<section id="outputTab" class="tab-panel">')

    # バージョンキャッシュバスターを rev60 に更新
    $html = [System.Text.RegularExpressions.Regex]::Replace($html, 'solver\.js\?v=[^"]+', 'solver.js?v=20261029_rev60')
    $html = [System.Text.RegularExpressions.Regex]::Replace($html, 'app\.js\?v=[^"]+', 'app.js?v=20261029_rev60')
    $html = [System.Text.RegularExpressions.Regex]::Replace($html, 'style\.css(\?v=[^"]+)?', 'style.css?v=20261029_rev60')

    [System.IO.File]::WriteAllText($p, $html, [System.Text.Encoding]::UTF8)
    Write-Output "Fixed tab-panel & rev60 in: $($f.Name)"
}
Write-Output "All files fixed successfully!"
