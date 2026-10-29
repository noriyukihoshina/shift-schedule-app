$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chromePath)) {
    $chromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
}

$tempHtml = Join-Path $PSScriptRoot "inspect_1f.html"
$htmlContent = @"
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<div id="outputTableFoot"><table><tfoot></tfoot></table></div>
<div id="checkTableFoot"><table><tfoot></tfoot></table></div>
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
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const halfStaff = [];
        if (typeof staffList !== 'undefined') {
            staffList.forEach((s, idx) => {
                if (!s.isUnused && s.isHalf) {
                    halfStaff.push({ idx: idx, id: s.id, name: s.name, sec: s.section, isHalf: s.isHalf });
                }
            });
        }
        document.body.setAttribute('data-half-staff', JSON.stringify(halfStaff));

        let linkedStInfo = [];
        if (typeof linkedStStaffData !== 'undefined' && linkedStStaffData && linkedStStaffData.staffList) {
            linkedStInfo = linkedStStaffData.staffList.map(s => ({ id: s.id, name: s.name, isHalf: s.isHalf, isZeroCount: s.isZeroCount, floor: s.floor }));
        }
        document.body.setAttribute('data-linked-st', JSON.stringify(linkedStInfo));

        // 1階のデフォルトスタッフマスタの初期値
        document.body.setAttribute('data-staff-count', staffList.filter(s => !s.isUnused).length);
        document.title = "INSPECTION_DONE";
    }, 1500);
});
</script>
</body>
</html>
"@
[System.IO.File]::WriteAllText($tempHtml, $htmlContent, [System.Text.Encoding]::UTF8)

$dumpFile = Join-Path $PSScriptRoot "inspect_dump.html"
& $chromePath --headless --disable-gpu --dump-dom "file:///$($tempHtml.Replace('\', '/'))" | Out-File $dumpFile -Encoding UTF8

$content = [System.IO.File]::ReadAllText($dumpFile, [System.Text.Encoding]::UTF8)
if ($content -match 'data-half-staff="([^"]+)"') {
    Write-Output "HALF STAFF IN 1F:"
    Write-Output $Matches[1]
}
if ($content -match 'data-linked-st="([^"]+)"') {
    Write-Output "LINKED ST:"
    Write-Output $Matches[1]
}
