$ErrorActionPreference = 'Stop'
$dir = "c:\Users\coffe\OneDrive\デスクトップ\Antigravity\勤務表作成"

# 1. life.html を 1f.html から生成
$content1f = Get-Content -Path (Join-Path $dir "1f.html") -Raw -Encoding UTF8
$lifeHtml = $content1f
$lifeHtml = $lifeHtml -replace '勤務予定表 自動作成システム - 1階病棟', '勤務予定表 自動作成システム - 生活期'
$lifeHtml = $lifeHtml -replace '勤務予定表 自動作成システム 〜 1階病棟 〜', '勤務予定表 自動作成システム 〜 生活期 〜'
$lifeHtml = $lifeHtml -replace 'class="theme-1f"', 'class="theme-life"'
$lifeHtml = $lifeHtml -replace "deptId:\s*'1f'", "deptId: 'life'"
$lifeHtml = $lifeHtml -replace "deptName:\s*'1階病棟'", "deptName: '生活期'"
$lifeHtml = $lifeHtml -replace "floor:\s*'1F'", "floor: '生活期', isLife: true"
$lifeHtml = $lifeHtml -replace "theme:\s*'theme-1f'", "theme: 'theme-life'"

[System.IO.File]::WriteAllText((Join-Path $dir "life.html"), $lifeHtml, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText((Join-Path $dir "生活期.html"), $lifeHtml, [System.Text.Encoding]::UTF8)
Write-Host "Created life.html and 生活期.html successfully."
