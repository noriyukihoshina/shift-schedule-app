$dir = Split-Path -Parent $MyInvocation.MyCommand.Path

Get-ChildItem $dir -Filter "*.html" | ForEach-Object {
    $fName = $_.Name
    if ($fName -notmatch '^test_' -and $fName -notmatch '^_test' -and $fName -notmatch '^debug_') {
        $p = $_.FullName
        $html = [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)
        if ($html.Contains("solver.js")) {
            $html = [System.Text.RegularExpressions.Regex]::Replace($html, 'solver\.js\?v=[^"]+', 'solver.js?v=20261029_rev59')
            $html = [System.Text.RegularExpressions.Regex]::Replace($html, 'app\.js\?v=[^"]+', 'app.js?v=20261029_rev59')
            $html = $html.Replace('☁️ クラウド同期確認中...', '🟢 自動保存稼働中')
            $html = $html.Replace('☁️ クラウド確認中...', '🟢 自動保存稼働中')
            [System.IO.File]::WriteAllText($p, $html, [System.Text.Encoding]::UTF8)
            Write-Output "Synced rev59 to: $fName"
        }
    }
}
