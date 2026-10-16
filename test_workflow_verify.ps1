$here = "c:\Users\coffe\OneDrive\デスクトップ\Antigravity\勤務表作成"
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'

Write-Host "=================================================="
Write-Host "  Starting Comprehensive Workflow & Rules Tests   "
Write-Host "=================================================="

# Test 1: Logic test via test_workflow_verify.html
$testHtml = Join-Path $here 'test_workflow_verify.html'
$dumpFile = Join-Path $here 'test_workflow_dump.txt'

$proc = Start-Process -FilePath $edge -ArgumentList "--headless", "--disable-gpu", "--dump-dom", "$testHtml" -RedirectStandardOutput $dumpFile -PassThru -NoNewWindow
$proc.WaitForExit(10000)

$dump = [System.IO.File]::ReadAllText($dumpFile, [System.Text.Encoding]::UTF8)
if ($dump -match '<div id="results">([^<]+)</div>') {
    $json = $matches[1]
    Write-Host "Logic Test Output:" -ForegroundColor Cyan
    Write-Host $json
} else {
    Write-Host "Could not find results div in dump." -ForegroundColor Red
}

# Test 2: index.html structure and UI rules verification
Write-Host "`nVerifying index.html and app.js UI rules..." -ForegroundColor Cyan
$html = [System.IO.File]::ReadAllText((Join-Path $here "index.html"), [System.Text.Encoding]::UTF8)
$app = [System.IO.File]::ReadAllText((Join-Path $here "app.js"), [System.Text.Encoding]::UTF8)

# Rule 1: Tab labels: 希望入力, 修正作業エリア, 最終チェック&完成
$tab1Ok = $html -match 'data-tab="inputTab"[^>]*>\s*<span>📋</span>\s*希望入力'
$tab2Ok = $html -match 'data-tab="outputTab"[^>]*>\s*<span>✏️</span>\s*修正作業エリア'
$tab3Ok = $html -match 'data-tab="checkTab"[^>]*>\s*<span>🔍</span>\s*最終チェック&完成'
Write-Host "1. Tab labels (希望入力 / 修正作業エリア / 最終チェック&完成): " -NoNewline
if ($tab1Ok -and $tab2Ok -and $tab3Ok) { Write-Host "PASSED" -ForegroundColor Green } else { Write-Host "FAILED ($tab1Ok, $tab2Ok, $tab3Ok)" -ForegroundColor Red }

# Rule 2: Force action buttons in error modal
$modalHasForceSolve = $html -match 'id="forceSolveBtn"'
$modalHasForceSpecial = $html -match 'id="forceAssignSpecialBtn"'
Write-Host "2. Error modal force buttons (無視して自動生成 / 無視して特殊勤務): " -NoNewline
if ($modalHasForceSolve -and $modalHasForceSpecial) { Write-Host "PASSED" -ForegroundColor Green } else { Write-Host "FAILED" -ForegroundColor Red }

# Rule 3: Stage 2 (outputTab) buttons
$stage2HasCopy = $html -match 'id="copyForExcelBtn"'
$stage2HasImport = $html -match 'id="importModifiedWorkAreaFileInput"'
$stage2HasValidate = $html -match 'id="validateWorkAreaBtn"'
$stage2HasAssignSpecial = $html -match 'id="outputAssignSpecialBtn"'
Write-Host "3. Stage 2 (修正作業エリア) buttons: " -NoNewline
if ($stage2HasCopy -and $stage2HasImport -and $stage2HasValidate -and $stage2HasAssignSpecial) { Write-Host "PASSED" -ForegroundColor Green } else { Write-Host "FAILED" -ForegroundColor Red }

# Rule 4: Stage 3 (checkTab) buttons
$stage3HasCopy = $html -match 'id="checkCopyForExcelBtn"'
$stage3HasImport = $html -match 'id="importModifiedScheduleFileInput"'
$stage3HasValidate = $html -match 'id="validateOutputBtn"'
$stage3HasExport = $html -match 'id="checkExportExcelBtn"'
Write-Host "4. Stage 3 (最終チェック&完成) buttons: " -NoNewline
if ($stage3HasCopy -and $stage3HasImport -and $stage3HasValidate -and $stage3HasExport) { Write-Host "PASSED" -ForegroundColor Green } else { Write-Host "FAILED" -ForegroundColor Red }

# Rule 5: Startup sample data removed (no loadSampleData call at startup)
$appStartupMatch = [regex]::Match($app, '(?s)// 初期起動.*?\}\);')
$startupText = $appStartupMatch.Value
$startupClean = (-not ($startupText -match 'loadSampleData\(\);')) -and ($startupText -match 'renderInputTable\(\);')
Write-Host "5. Initial state clean (no sample data on startup): " -NoNewline
if ($startupClean) { Write-Host "PASSED" -ForegroundColor Green } else { Write-Host "FAILED ($startupText)" -ForegroundColor Red }

# Rule 6: Holiday styling check in app.js
$holidayInRenderInput = $app -match 'di\.wIdx === 6 \|\| di\.isHoliday'
$holidayInRenderOutput = $app -match 'dateInfo\.wIdx === 6 \|\| dateInfo\.isHoliday'
Write-Host "6. Holiday red color styling (header-sun for holidays): " -NoNewline
if ($holidayInRenderInput -and $holidayInRenderOutput) { Write-Host "PASSED" -ForegroundColor Green } else { Write-Host "FAILED" -ForegroundColor Red }

Write-Host "`n=================================================="
Write-Host "             Verification Complete                "
Write-Host "=================================================="
