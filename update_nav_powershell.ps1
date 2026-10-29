$dir = "c:\Users\coffe\OneDrive\デスクトップ\Antigravity\勤務表作成"

# 1. 1f.html から life.html, 生活期.html を生成
$content1f = [System.IO.File]::ReadAllText((Join-Path $dir "1f.html"), [System.Text.Encoding]::UTF8)
$lifeHtml = $content1f
$lifeHtml = $lifeHtml -replace '1階病棟', '生活期'
$lifeHtml = $lifeHtml -replace 'class="theme-1f"', 'class="theme-life"'
$lifeHtml = $lifeHtml -replace "deptId:\s*'1f'", "deptId: 'life'"
$lifeHtml = $lifeHtml -replace "floor:\s*'1F'", "floor: '生活期',`n            isLife: true"
$lifeHtml = $lifeHtml -replace "theme:\s*'theme-1f'", "theme: 'theme-life'"

[System.IO.File]::WriteAllText((Join-Path $dir "life.html"), $lifeHtml, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText((Join-Path $dir "生活期.html"), $lifeHtml, [System.Text.Encoding]::UTF8)
Write-Output "Created life.html and 生活期.html"

# 2. 対象ファイル一覧
$targetFiles = @(
    'index.html', 'マスターテーブル.html', 'master.html',
    '1f.html', '1階病棟.html',
    '2f.html', '2階病棟.html',
    '3f.html', '3階病棟.html',
    'south.html', '南病棟.html',
    'ST.html',
    'life.html', '生活期.html', '生活期_管理者.html'
)

foreach ($f in $targetFiles) {
    $p = Join-Path $dir $f
    if (Test-Path $p) {
        $c = [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)
        $c = $c -replace 'rev65', 'rev66'
        if (-not ($c -match 'href="life\.html"')) {
            $isLife = ($f -match 'life' -or $f -match '生活期')
            $activeCls = if ($isLife) { " active" } else { "" }
            $btn = "`r`n        <a href=""life.html"" class=""dept-nav-btn dept-nav-life$activeCls"" style=""background:#f0fdfa; border-color:#99f6e4; color:#0f766e;"">生活期</a>"
            $c = [System.Text.RegularExpressions.Regex]::Replace($c, '(<a href="ST\.html"[^>]*>[\s\S]*?<\/a>)', "`$1$btn")
        }
        [System.IO.File]::WriteAllText($p, $c, [System.Text.Encoding]::UTF8)
        Write-Output "Updated $f"
    }
}
