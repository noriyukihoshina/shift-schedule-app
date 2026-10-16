$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$here = $PSScriptRoot
$testHtml = Join-Path $here "test_direct_logic.html"
$testUri = [System.Uri]::new($testHtml).AbsoluteUri
$dumpFile = Join-Path $here "test_direct_logic_dump.txt"

Write-Host "=========================================="
Write-Host " Running Direct Logic Tests in Edge..."
Write-Host "=========================================="

cmd.exe /c "`"$edgePath`" --headless --disable-gpu --dump-dom `"$testUri`" > `"$dumpFile`""

if (Test-Path $dumpFile) {
    $content = Get-Content $dumpFile -Raw -Encoding UTF8
    if ($content -match 'ALL_PASSED') {
        Write-Host "LOGIC TEST RESULT: ALL PASSED" -ForegroundColor Green
    } else {
        Write-Host "LOGIC TEST RESULT: FAILED" -ForegroundColor Red
    }
    if ($content -match '<div id="test-output">([\s\S]*?)</div>') {
        Write-Host $matches[1]
    }
} else {
    Write-Host "Dump file not generated." -ForegroundColor Red
}

Write-Host "`n=========================================="
Write-Host " Verifying index.html and app.js UI rules..."
Write-Host "=========================================="

$html = Get-Content (Join-Path $here "index.html") -Raw -Encoding UTF8
$app = Get-Content (Join-Path $here "app.js") -Raw -Encoding UTF8

# Check 1: Tab labels by checking data-tab presence
$hasTab1 = $html.Contains('data-tab="inputTab"')
$hasTab2 = $html.Contains('data-tab="outputTab"')
$hasTab3 = $html.Contains('data-tab="checkTab"')
$hasTab4 = $html.Contains('data-tab="statsTab"')
Write-Host "1. Tabs presence: " -NoNewline
if ($hasTab1 -and $hasTab2 -and $hasTab3 -and $hasTab4) { Write-Host "PASSED" -ForegroundColor Green } else { Write-Host "FAILED" -ForegroundColor Red }

# Check 2: Modal Force buttons
$hasForceSolve = $html.Contains('id="forceSolveBtn"')
$hasForceSpecial = $html.Contains('id="forceAssignSpecialBtn"')
Write-Host "2. Modal force buttons: " -NoNewline
if ($hasForceSolve -and $hasForceSpecial) { Write-Host "PASSED" -ForegroundColor Green } else { Write-Host "FAILED" -ForegroundColor Red }

# Check 3: Stage 2 Buttons
$hasStage2Copy = $html.Contains('id="copyForExcelBtn"')
$hasStage2Import = $html.Contains('id="importModifiedWorkAreaFileInput"')
$hasStage2Val = $html.Contains('id="validateWorkAreaBtn"')
$hasStage2Spec = $html.Contains('id="outputAssignSpecialBtn"')
Write-Host "3. Stage 2 buttons: " -NoNewline
if ($hasStage2Copy -and $hasStage2Import -and $hasStage2Val -and $hasStage2Spec) { Write-Host "PASSED" -ForegroundColor Green } else { Write-Host "FAILED" -ForegroundColor Red }

# Check 4: Stage 3 Buttons
$hasStage3Copy = $html.Contains('id="checkCopyForExcelBtn"')
$hasStage3Import = $html.Contains('id="importModifiedScheduleFileInput"')
$hasStage3Val = $html.Contains('id="validateOutputBtn"')
$hasStage3Export = $html.Contains('id="checkExportExcelBtn"')
Write-Host "4. Stage 3 buttons: " -NoNewline
if ($hasStage3Copy -and $hasStage3Import -and $hasStage3Val -and $hasStage3Export) { Write-Host "PASSED" -ForegroundColor Green } else { Write-Host "FAILED" -ForegroundColor Red }

# Check 5: Initial State Clean
$hasNoSample = -not $app.Contains('initStaffData();' + "`r`n" + '    loadSampleData();')
$hasInitTable = $app.Contains('renderInputTable()')
Write-Host "5. Initial state clean (no sample data on startup): " -NoNewline
if ($hasNoSample -and $hasInitTable) { Write-Host "PASSED" -ForegroundColor Green } else { Write-Host "FAILED" -ForegroundColor Red }

# Check 6: Holiday red styling
$holidayCheckInput = $app.Contains('di.isHoliday')
$holidayCheckOutput = $app.Contains('dateInfo.isHoliday')
Write-Host "6. Holiday red color styling: " -NoNewline
if ($holidayCheckInput -and $holidayCheckOutput) { Write-Host "PASSED" -ForegroundColor Green } else { Write-Host "FAILED" -ForegroundColor Red }

Write-Host "`n=========================================="
Write-Host " Verification Finished"
Write-Host "=========================================="
