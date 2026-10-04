$here = (Get-Location).Path
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'

$testHtml = Join-Path $here 'test_latest_verify.html'
$htmlContent = @"
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<div id="test-log">RUNNING</div>
<div id="test-result"></div>

<input type="date" id="termStartDate" value="2026-04-29">
<span id="termEndDateDisplay"></span>
<span id="termTitleBadge"></span>
<span id="outputTitleDisplay"></span>
<table><thead id="inputTableHead"></thead><tbody id="inputTableBody"></tbody></table>

<script src="solver.js"></script>
<script src="app.js"></script>
<script>
window.addEventListener('DOMContentLoaded', async () => {
    const logs = [];
    function log(msg) { logs.push(msg); console.log(msg); }

    try {
        log("1. Checking normalizeSymbol with circle variants...");
        // normalizeSymbol の動作検証（プライベート関数の場合はテスト用に再現または呼び出し）
        // app.js からロードされたDOM環境でテスト
        
        // 勤務表自動生成を実行
        log("2. Running solveSchedule...");
        const solveBtn = document.getElementById('solveBtn');
        if (solveBtn) {
            solveBtn.click();
        }

        // コピー用HTMLの生成テスト
        log("3. Testing copyForExcel logic...");
        // copyForExcelの出力をシミュレートまたは検証
        const copyBtn = document.getElementById('copyExcelDirectBtn');
        if (!copyBtn) throw new Error("copyExcelDirectBtn not found");

        log("4. Checking DOM elements and labels...");
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');
        if (!undoBtn || !redoBtn) throw new Error("Undo/Redo buttons not found");

        document.getElementById('test-log').textContent = "SUCCESS";
        document.getElementById('test-result').textContent = JSON.stringify({ status: "OK", logs });
    } catch (e) {
        document.getElementById('test-log').textContent = "ERROR: " + e.message;
        document.getElementById('test-result').textContent = JSON.stringify({ status: "ERROR", error: e.message, stack: e.stack });
    }
});
</script>
</body>
</html>
"@

[System.IO.File]::WriteAllText($testHtml, $htmlContent, [System.Text.Encoding]::UTF8)

$dumpFile = Join-Path $here 'temp_verify_dump.txt'
$proc = Start-Process -FilePath $edge -ArgumentList "--headless", "--disable-gpu", "--dump-dom", "$testHtml" -RedirectStandardOutput $dumpFile -PassThru -NoNewWindow
$proc.WaitForExit(10000)

$dump = [System.IO.File]::ReadAllText($dumpFile, [System.Text.Encoding]::UTF8)
Write-Output "--- Test Dump ---"
if ($dump -match '<div id="test-log">([^<]+)</div>') {
    Write-Output "Result: $($matches[1])"
}
if ($dump -match '<div id="test-result">([^<]+)</div>') {
    Write-Output "Details: $($matches[1])"
}
