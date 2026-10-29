$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chromePath)) {
    $chromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
}

$tempHtml = Join-Path $PSScriptRoot "test_headcount_all.html"
$htmlContent = @"
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<div id="checkTableFoot"></div>
<div id="outputTableFoot"></div>
<script>
window.APP_CONFIG = {
    deptId: '1f',
    deptName: '1階病棟',
    floor: '1F',
    theme: 'theme-1f'
};
</script>
<script src="solver.js"></script>
<script src="app.js"></script>
<script>
// 同期実行
(function() {
    try {
        const scheduler = new ShiftScheduler(staffList, {
            standardHolidays: 8.0,
            dates: getTermInfo().dates,
            dayOffsets: new Array(28).fill(0),
            isST: false,
            isSouth: false,
            isLife: false,
            stDailyWork: getLinkedSTDailyWork(),
            stDailyHeadCount: getLinkedSTDailyHeadCount(),
            stDailyFtWork: getLinkedSTDailyFtWork()
        });
        const stats = scheduler.calculateStats();
        
        const nonIntTotalWork = [];
        stats.daily.forEach((d, idx) => {
            if (d.totalWork % 1 !== 0) {
                nonIntTotalWork.push({ day: idx + 1, totalWork: d.totalWork, realWork: d.realWork });
            }
        });
        
        document.body.setAttribute('data-non-int-count', nonIntTotalWork.length);
        document.body.setAttribute('data-sample-totals', JSON.stringify(stats.daily.slice(0, 7).map(d => ({ total: d.totalWork, real: d.realWork }))));
    } catch(e) {
        document.body.setAttribute('data-err', e.message);
    }
})();
</script>
</body>
</html>
"@
[System.IO.File]::WriteAllText($tempHtml, $htmlContent, [System.Text.Encoding]::UTF8)

$dumpFile = Join-Path $PSScriptRoot "test_headcount_dump.html"
& $chromePath --headless --disable-gpu --dump-dom "file:///$($tempHtml.Replace('\', '/'))" | Out-File $dumpFile -Encoding UTF8

$content = [System.IO.File]::ReadAllText($dumpFile, [System.Text.Encoding]::UTF8)
if ($content -match 'data-non-int-count="([^"]+)"') {
    Write-Output ("NON INTEGER TOTAL WORK COUNT: " + $Matches[1])
}
if ($content -match 'data-sample-totals="([^"]+)"') {
    Write-Output ("SAMPLE TOTALS: " + $Matches[1].Replace('&quot;', '"'))
}
if ($content -match 'data-err="([^"]+)"') {
    Write-Output ("ERROR: " + $Matches[1])
}
