$here = Get-Location
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$url = Join-Path $here "index.html"

# Run headless Edge to trigger copyForExcel and get clipboard or html
$htmlFile = Join-Path $here "temp_get_clipboard.html"
$injected = @"
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<div id="res">WORKING</div>
<script src="solver.js"></script>
<script src="app.js"></script>
<script>
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        // 自動作成実行
        const autoBtn = document.getElementById('autoGenerateBtn');
        if (autoBtn) autoBtn.click();

        setTimeout(() => {
            // copyForExcelを実行
            const copyBtn = document.getElementById('copyForExcelBtn');
            if (copyBtn) copyBtn.click();

            // copyForExcelのHTML生成部分を再現して取得
            // app.jsのcopyForExcelと同じ処理
            const term = getTermInfo();
            const startCol = 'C';
            const endCol = 'AD';

            // スタッフ2 (s=1, rowNum=4)
            const staff = staffList[1];
            const rowNum = 4;
            const rng = `${startCol}${rowNum}:${endCol}${rowNum}`;

            const fWork = `=COUNTIF(${rng},"○")+COUNTIF(${rng},"出")+COUNTIF(${rng},"早")+COUNTIF(${rng},"遅")+COUNTIF(${rng},"E")+COUNTIF(${rng},"8時")+0.5*(COUNTIF(${rng},"○/休")+COUNTIF(${rng},"休/○")+COUNTIF(${rng},"○/有")+COUNTIF(${rng},"有/○"))`;
            const fOff = `=COUNTIF(${rng},"休")+0.5*(COUNTIF(${rng},"○/休")+COUNTIF(${rng},"休/○"))`;
            const fPaid = `=COUNTIF(${rng},"有")+0.5*(COUNTIF(${rng},"○/有")+COUNTIF(${rng},"有/○"))`;

            document.getElementById('res').innerText = JSON.stringify({
                rng: rng,
                fWork: fWork,
                fOff: fOff,
                fPaid: fPaid,
                staff2_days: staff.days.slice(0, 5)
            });
        }, 500);
    }, 200);
});
</script>
</body>
</html>
"@
[System.IO.File]::WriteAllText($htmlFile, $injected, [System.Text.Encoding]::UTF8)

$outFile = Join-Path $here "temp_clip_out.txt"
& $edge --headless --virtual-time-budget=2000 --dump-dom $htmlFile | Out-File -Encoding utf8 $outFile

$dump = [System.IO.File]::ReadAllText($outFile, [System.Text.Encoding]::UTF8)
Write-Output $dump
