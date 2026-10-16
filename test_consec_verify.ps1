$here = (Get-Location).Path
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'

$testHtml = Join-Path $here 'test_consec_and_circles_verify.html'
$htmlContent = @"
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<div id="test-log">RUNNING</div>
<div id="test-result"></div>

<input type="date" id="termStartDate" value="2026-06-01">
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
        log("--- TEST 1: 連勤ルール（公休基準カウント）の単体テスト ---");
        // テスト用のダミースタッフリストを作成
        const testStaff = [
            { id: 1, name: "テスト1 (5連勤OK)", can8: false, noEarly: false, noLate: false, noEve: false, prevDays: ['休','休','休','休','休'], days: new Array(28).fill('') },
            { id: 2, name: "テスト2 (有休挟み11連勤NG)", can8: false, noEarly: false, noLate: false, noEve: false, prevDays: ['休','休','休','休','休'], days: new Array(28).fill('') },
            { id: 3, name: "テスト3 (リフ休挟み6連勤NG)", can8: false, noEarly: false, noLate: false, noEve: false, prevDays: ['休','休','休','休','休'], days: new Array(28).fill('') }
        ];

        // テスト1: 休 ○ ○ ○ ○ ○ 休 (5連勤) -> OK
        testStaff[0].days[0] = '休';
        testStaff[0].days[1] = '○';
        testStaff[0].days[2] = '○';
        testStaff[0].days[3] = '○';
        testStaff[0].days[4] = '○';
        testStaff[0].days[5] = '○';
        testStaff[0].days[6] = '休';

        // テスト2: 休 ○ ○ ○ ○ ○ 有 ○ ○ ○ ○ ○ 休 (11連勤) -> NG
        testStaff[1].days[0] = '休';
        testStaff[1].days[1] = '○';
        testStaff[1].days[2] = '○';
        testStaff[1].days[3] = '○';
        testStaff[1].days[4] = '○';
        testStaff[1].days[5] = '○';
        testStaff[1].days[6] = '有';
        testStaff[1].days[7] = '○';
        testStaff[1].days[8] = '○';
        testStaff[1].days[9] = '○';
        testStaff[1].days[10] = '○';
        testStaff[1].days[11] = '○';
        testStaff[1].days[12] = '休';

        // テスト3: 休 ○ ○ ○ ○ ○ 上1 休 (6日公休なし) -> NG
        testStaff[2].days[0] = '休';
        testStaff[2].days[1] = '○';
        testStaff[2].days[2] = '○';
        testStaff[2].days[3] = '○';
        testStaff[2].days[4] = '○';
        testStaff[2].days[5] = '○';
        testStaff[2].days[6] = '上1';
        testStaff[2].days[7] = '休';

        const valRes = validateInitialState(testStaff);
        log("Validation errors: " + JSON.stringify(valRes.errors));

        const errStr = valRes.errors.join("\n");
        if (!errStr.includes("テスト2")) {
            throw new Error("テスト2 (有休挟み11連勤) がエラーとして検知されませんでした！");
        }
        if (!errStr.includes("テスト3")) {
            throw new Error("テスト3 (リフ休挟み6連勤) がエラーとして検知されませんでした！");
        }
        if (errStr.includes("テスト1")) {
            throw new Error("テスト1 (5連勤OK) が誤ってエラー判定されました！");
        }
        log("✅ 連勤ルール単体テスト成功: 有休・リフ休を挟む連続勤務が正しく公休基準で11連勤/6連勤違反として判定されました！");

        log("--- TEST 2: ソルバー全体の自動生成と連勤検証 ---");
        // サンプルデータでソルバーを実行
        loadSampleData();
        const solver = new ScheduleSolver(staffList, { standardHolidays: 8.0, termTitle: "テスト期間" });
        const solution = solver.solve();
        if (!solution || !solution.grid) {
            throw new Error("ソルバーの実行に失敗しました。");
        }
        log("Solver solved successfully. Status: " + solution.status);

        // 全スタッフの全日程において、公休から公休の間隔が5日以内であることを厳密検証！
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
                        throw new Error(`スタッフ ${staffList[s].name} で公休なし ${consec} 日連続が検出されました！ [${seq.slice(5).join(',')}]`);
                    }
                } else {
                    consec = 0;
                }
            }
        }
        log("✅ 全スタッフ50名の連勤検証成功: 全日程で公休なし連続日数は最大 " + maxObservedStreak + " 日（5日以下を完全遵守）でした！");

        document.getElementById('test-log').textContent = "ALL_TESTS_PASSED";
        document.getElementById('test-result').textContent = JSON.stringify({ status: "SUCCESS", maxStreak: maxObservedStreak, logs });
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

$dumpFile = Join-Path $here 'temp_consec_dump.txt'
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
