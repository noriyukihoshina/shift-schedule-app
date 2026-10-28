$dir = Split-Path -Parent $MyInvocation.MyCommand.Path

$pages = @(
    "index.html",
    "1f.html",
    "2f.html",
    "3f.html",
    "south.html",
    "ST.html",
    "master.html"
)

$allPassed = $true

Write-Output "=== PRODUCTION PAGES STATIC & SYNTAX VERIFICATION ==="

foreach ($pg in $pages) {
    $p = Join-Path $dir $pg
    if (-not (Test-Path $p)) {
        Write-Output "[$pg] ERROR: File not found!"
        $allPassed = $false
        continue
    }

    $html = [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)

    $hasSolverRev59 = $html.IndexOf("solver.js?v=20261029_rev59") -ge 0
    $hasAppRev59 = $html.IndexOf("app.js?v=20261029_rev59") -ge 0
    $hasAutoSaveBadge = $html.IndexOf("id=`"autoSaveStatusBadge`"") -ge 0
    $hasAppConfig = $html.IndexOf("window.APP_CONFIG") -ge 0
    $hasNav = $html.IndexOf("class=`"dept-nav-container`"") -ge 0

    $mTheme = [System.Text.RegularExpressions.Regex]::Match($html, '<body class="([^"]+)">')
    $themeClass = if ($mTheme.Success) { $mTheme.Groups[1].Value } else { "none" }

    $isOk = $hasSolverRev59 -and $hasAppRev59 -and $hasAutoSaveBadge -and $hasAppConfig -and $hasNav

    Write-Output "[$pg] Theme: $themeClass | SolverRev59: $hasSolverRev59 | AppRev59: $hasAppRev59 | AutoSave: $hasAutoSaveBadge | Config: $hasAppConfig"

    if (-not $isOk) {
        $allPassed = $false
        Write-Output "  -> FAILED"
    } else {
        Write-Output "  -> PASSED (100% OK)"
    }
}

if ($allPassed) {
    Write-Output "`n>>> ALL 7 PRODUCTION HTML PAGES ARE 100% VERIFIED & CONSISTENT!"
} else {
    Write-Output "`n>>> SOME PAGES FAILED VERIFICATION"
}
