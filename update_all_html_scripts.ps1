$dir = Split-Path -Parent $MyInvocation.MyCommand.Path

$files = @(
    "index.html",
    "1f.html",
    "1階病棟.html",
    "2f.html",
    "2階病棟.html",
    "3f.html",
    "3階病棟.html",
    "south.html",
    "南病棟.html",
    "ST.html",
    "st.html",
    "master.html",
    "マスターテーブル.html"
)

foreach ($f in $files) {
    $p = Join-Path $dir $f
    if (Test-Path $p) {
        $html = [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)

        # キャッシュバスターの更新 (rev59)
        $html = [System.Text.RegularExpressions.Regex]::Replace($html, 'solver\.js\?v=[^"]+', 'solver.js?v=20261029_rev59')
        $html = [System.Text.RegularExpressions.Regex]::Replace($html, 'app\.js\?v=[^"]+', 'app.js?v=20261029_rev59')

        # 自動保存ステータス初期表示を「🟢 自動保存稼働中」に更新
        $html = $html.Replace('☁️ クラウド同期確認中...', '🟢 自動保存稼働中')
        $html = $html.Replace('☁️ クラウド確認中...', '🟢 自動保存稼働中')

        [System.IO.File]::WriteAllText($p, $html, [System.Text.Encoding]::UTF8)
        Write-Output "Updated: $f"
    }
}
