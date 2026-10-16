$here = (Get-Location).Path
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'

$testHtml = Join-Path $here 'test_sync_runner.html'
$htmlContent = @"
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<div id="test-log">PENDING</div>
<div id="test-result"></div>

<input type="date" id="termStartDate" value="2026-06-01">
<span id="termEndDateDisplay"></span>
<span id="termTitleBadge"></span>
<span id="outputTitleDisplay"></span>
<table><thead id="inputTableHead"></thead><tbody id="inputTableBody"></tbody></table>

<script src="solver.js"></script>
<script src="app.js"></script>
<script>
(function runTests() {
    const logs = [];
    function log(msg) { logs.push(msg); }

    try {
        log("1. 連勤ルール（公休基準カウント）の単体テスト");
        const testStaff = [
            { id: 1, name: "テスト1", can8: false, noEarly: false, noLate: false, noEve: false, prevDays: ['休','休','休','休','休'], days: new Array(28).fill('') },
            { id: 2, name: "テスト2", can8: false, noEarly: false, noLate: false, noEve: false, prevDays: ['休','休','休','休','休'], days: new Array(28).fill('') },
            { id: 3, name: "テスト3", can8: false, noEarly: false, noLate: false, noEve: false, prevDays: ['休','休','休','休','休'], days: new Array(28).fill('') }
        ];

        // テスト1: 休 ○ ○ ○ ○ ○ 休 (5連勤) -> OK
        testStaff[0].days[0] = '休';
        for(let i=1; i<=5; i++) testStaff[0].days[i] = '○';
        testStaff[0].days[6] = '休';

        // テスト2: 休 ○ ○ ○ ○ ○ 有 ○ ○ ○ ○ ○ 休 (11連勤) -> NG
        testStaff[1].days[0] = '休';
        for(let i=1; i<=5; i++) testStaff[1].days[i] = '○';
        testStaff[1].days[6] = '有';
        for(let i=7; i<=11; i++) testStaff[1].days[i] = '○';
        testStaff[1].days[12] = '休';

        // テスト3: 休 ○ ○ ○ ○ ○ 上1 休 (6日) -> NG
        testStaff[2].days[0] = '休';
        for(let i=1; i<=5; i++) testStaff[2].days[i] = '○';
        testStaff[2].days[6] = '上1';
        testStaff[2].days[7] = '休';

        const valRes = validateInitialState(testStaff);
        const errStr = valRes.errors.join("\n");
        if (!errStr.includes("テスト2")) throw new Error("有休挟み11連勤が検知されませんでした");
        if (!errStr.includes("テスト3")) throw new Error("リフ休挟み6連勤が検知されませんでした");
        if (errStr.includes("テスト1")) throw new Error("5連勤OKが誤検知されました");
        log("OK: 単体テスト合格");

        log("2. ソルバーの自動生成実行");
        initStaffData();
        loadSampleData();
        const solver = new ScheduleSolver(staffList, { standardHolidays: 8.0, termTitle: "テスト期間" });
        const solution = solver.solve();
        if (!solution || !solution.grid) throw new Error("ソルバー生成失敗");

        log("3. 全スタッフの連勤厳密チェック");
        let maxObservedStreak = 0;
        for (let s = 0; s < 50; s++) {
            const seq = [];
            for (let p = 0; p < 5; p++) seq.push(staffList[s].prevDays[p]);
            for (let d = 0; d < 28; d++) seq.push(solution.grid[s][d].symbol);

            let consec = 0;
            for (let i = 0; i < seq.length; i++) {
                if (seq[i] !== '休') {
                    consec++;
                    if (consec > maxObservedStreak) maxObservedStreak = consec;
                    if (consec > 5) {
                        throw new Error("スタッフ" + staffList[s].name + "で公休なし" + consec + "日連続違反");
                    }
                } else {
                    consec = 0;
                }
            }
        }
        log("OK: 最大連続日数=" + maxObservedStreak);

        document.getElementById('test-log').textContent = "ALL_TESTS_PASSED";
        document.getElementById('test-result').textContent = JSON.stringify({ status: "SUCCESS", maxStreak: maxObservedStreak, logs });
    } catch (e) {
        document.getElementById('test-log').textContent = "ERROR: " + e.message;
        document.getElementById('test-result').textContent = JSON.stringify({ status: "ERROR", error: e.message });
    }
})();
</script>
</body>
</html>
"@

[System.IO.File]::WriteAllText($testHtml, $htmlContent, [System.Text.Encoding]::UTF8)

$dumpFile = Join-Path $here 'temp_sync_dump.txt'
$proc = Start-Process -FilePath $edge -ArgumentList "--headless", "--disable-gpu", "--dump-dom", "$testHtml" -RedirectStandardOutput $dumpFile -PassThru -NoNewWindow
$proc.WaitForExit(10000)
Start-Sleep -Milliseconds 500

$dump = [System.IO.File]::ReadAllText($dumpFile, [System.Text.Encoding]::UTF8)
Write-Output "--- Test Dump ---"
if ($dump -match '<div id="test-log">([^<]+)</div>') {
    Write-Output "Result: $($matches[1])"
}
if ($dump -match '<div id="test-result">([^<]+)</div>') {
    Write-Output "Details: $($matches[1])"
}
