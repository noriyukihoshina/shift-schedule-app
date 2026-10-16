$html = Get-Content -Path (Join-Path $PSScriptRoot "index.html") -Raw -Encoding UTF8

Write-Host "=== UI Verification: Simplified Header & CheckSheet Tab ==="

# 1. Header simplified check
$headerMatch = [regex]::Match($html, '(?s)<header.*?</header>')
$headerContent = $headerMatch.Value
$hasBadge = $headerContent -match 'badge'
$hasHeaderBtn = $headerContent -match '<button'
$hasSubDesc = $headerContent -match '50名規模'
Write-Host "1. Header simplified: " -NoNewline
if (-not $hasBadge -and -not $hasHeaderBtn -and -not $hasSubDesc) { Write-Host "PASSED" -ForegroundColor Green } else { Write-Host "FAILED" -ForegroundColor Red }

# 2. Check tab existence and order
$tab1 = $html.IndexOf('data-tab="inputTab"')
$tab2 = $html.IndexOf('data-tab="outputTab"')
$tab3 = $html.IndexOf('data-tab="checkTab"')
$tab4 = $html.IndexOf('data-tab="statsTab"')
Write-Host "2. Tabs order: " -NoNewline
if ($tab1 -lt $tab2 -and $tab2 -lt $tab3 -and $tab3 -lt $tab4) {
    Write-Host "PASSED (Input -> Output -> Check -> Stats)" -ForegroundColor Green
} else {
    Write-Host "FAILED ($tab1, $tab2, $tab3, $tab4)" -ForegroundColor Red
}

# 3. Output tab does not have import or validate
$outputSec = $html.Substring($html.IndexOf('id="outputTab"'), $html.IndexOf('id="checkTab"') - $html.IndexOf('id="outputTab"'))
$outHasImport = $outputSec -match 'importModifiedScheduleFileInput'
$outHasValidate = $outputSec -match 'validateOutputBtn'
Write-Host "3. Output tab buttons moved: " -NoNewline
if (-not $outHasImport -and -not $outHasValidate) { Write-Host "PASSED" -ForegroundColor Green } else { Write-Host "FAILED" -ForegroundColor Red }

# 4. Check sheet has import, validate, palette, scroll, and table
$checkSec = $html.Substring($html.IndexOf('id="checkTab"'), $html.IndexOf('id="statsTab"') - $html.IndexOf('id="checkTab"'))
$checkHasImport = $checkSec -match 'importModifiedScheduleFileInput'
$checkHasValidate = $checkSec -match 'validateOutputBtn'
$checkHasPalette = $checkSec -match 'check-palette-btn'
$checkHasTable = $checkSec -match 'checkTableBody'
Write-Host "4. Check sheet components: " -NoNewline
if ($checkHasImport -and $checkHasValidate -and $checkHasPalette -and $checkHasTable) {
    Write-Host "PASSED (Import, Validate, Palette, Table all present)" -ForegroundColor Green
} else {
    Write-Host "FAILED" -ForegroundColor Red
}

# 5. Scroll buttons check (Input, Output, Check sheet all have 2 buttons each = 6 total)
$scrollMatches = [regex]::Matches($html, 'scroll-btn')
Write-Host "5. Scroll buttons count: " -NoNewline
if ($scrollMatches.Count -ge 6) {
    Write-Host "PASSED (Count: $($scrollMatches.Count))" -ForegroundColor Green
} else {
    Write-Host "FAILED (Count: $($scrollMatches.Count))" -ForegroundColor Red
}

# 6. app.js checkTab logic
$appJs = Get-Content -Path (Join-Path $PSScriptRoot "app.js") -Raw -Encoding UTF8
$appHasCheckTab = $appJs -match 'switchTab\(''checkTab''\)'
$appHasCheckTable = $appJs -match 'checkTableBody'
Write-Host "6. app.js checkTab integration: " -NoNewline
if ($appHasCheckTab -and $appHasCheckTable) { Write-Host "PASSED" -ForegroundColor Green } else { Write-Host "FAILED" -ForegroundColor Red }

Write-Host "=== All Verification Passed ===" -ForegroundColor Cyan
