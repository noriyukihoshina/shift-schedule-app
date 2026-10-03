$here = Get-Location
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'

$testHtml = Join-Path $here 'test_import_period_sync.html'
$htmlContent = @'
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<input type="date" id="termStartDate" value="2026-04-01">
<span id="termEndDateDisplay"></span>
<span id="termTitleBadge"></span>
<span id="outputTitleDisplay"></span>
<table><thead id="inputTableHead"></thead><tbody id="inputTableBody"></tbody></table>

<div id="test-log">RUNNING</div>

<script src="solver.js"></script>
<script src="app.js"></script>
<script>
window.addEventListener('DOMContentLoaded', async () => {
    const logs = [];
    function log(msg) { logs.push(msg); console.log(msg); }

    try {
        log("1. Initial state checked.");
        // 初期状態: 2026-04-01
        if (document.getElementById('termStartDate').value !== '2026-04-01') {
            throw new Error("Initial date is not 2026-04-01");
        }

        // 初期状態でサンプルデータ投入
        loadSampleData();
        renderInputTable();

        // 鈴木美咲(sIdx=1)の初期サンプルデータ確認 (5日目に有、10日目に休)
        if (staffList[1].days[4] !== '有' || staffList[1].days[9] !== '休') {
            throw new Error("Initial sample data for staff 2 not loaded properly");
        }
        log("2. Sample data confirmed present before import.");

        // 4/29〜5/26 の XLSX バイナリを downloadBlankXlsx と同等のロジックで生成
        // ここでは termStartDate を一時的に 2026-04-29 にして generateBlankXlsxBytes
        document.getElementById('termStartDate').value = '2026-04-29';
        getTermInfo();

        // 4/29〜5/26 のシートを模したバイナリを downloadBlankXlsx から生成
        // （app.js内のcreateZipUint8Array等を利用、または手動テストバイナリ）
        // 既存の verified_staff_blank_template.xlsx の ArrayBuffer を fetch で取得
        const resp = await fetch('verified_staff_blank_template.xlsx');
        const buf = await resp.arrayBuffer();

        // 再度画面を 2026-04-01 に戻して、インポートによって自動更新されるかを検証
        document.getElementById('termStartDate').value = '2026-04-01';
        getTermInfo();
        renderInputTable();

        log("3. Reset termStartDate to 2026-04-01. Now simulating file import...");

        // parseXlsxBuffer 実行
        const parseResult = await parseXlsxBuffer(buf);
        log("4. parseXlsxBuffer completed. detected startDate=" + parseResult.startDate + ", items count=" + parseResult.items.length);

        if (parseResult.startDate !== '2026-04-29') {
            throw new Error("Expected startDate 2026-04-29, got " + parseResult.startDate);
        }

        // importScheduleFileInput の処理をシミュレート
        if (parseResult.startDate) {
            document.getElementById('termStartDate').value = parseResult.startDate;
            getTermInfo();
        }

        // テスト用として、取り込みデータに 佐藤健一(0) の 2日目に '休', 3日目に '有' を1件追加
        parseResult.items.push({ staffIdx: 0, dayIdx: 2, symbol: '休' });
        parseResult.items.push({ staffIdx: 0, dayIdx: 3, symbol: '有' });

        // replace モードで反映
        applyScheduleImport(parseResult.items, 'replace');

        // 検証1: 期間が 2026-04-29 〜 2026-05-26 に自動更新されたか
        const curStart = document.getElementById('termStartDate').value;
        const curEnd = document.getElementById('termEndDateDisplay').textContent;
        const curBadge = document.getElementById('termTitleBadge').textContent;

        log("5. Verified dates: Start=" + curStart + ", End=" + curEnd + ", Badge=" + curBadge);
        if (curStart !== '2026-04-29') throw new Error("termStartDate was not updated to 2026-04-29!");
        if (curEnd !== '2026-05-26') throw new Error("termEndDateDisplay was not updated to 2026-05-26!");
        if (!curBadge.includes('4/29～5/26')) throw new Error("Badge does not show 4/29～5/26!");

        // 検証2: テーブルヘッダーが 4/29(水) 〜 5/26(火) になっているか (1月 2火 ではない！)
        const ths = document.querySelectorAll('#inputTableHead tr:nth-child(2) th');
        // ths[0]〜ths[4] は 前5〜前1、ths[5] が 1日目(4/29 水)
        const firstDayTh = ths[5];
        const lastDayTh = ths[ths.length - 1];

        log("6. Header cells: FirstDay=" + firstDayTh.innerText.replace('\n', ' ') + ", LastDay=" + lastDayTh.innerText.replace('\n', ' '));
        if (!firstDayTh.innerText.includes('4/29') || !firstDayTh.innerText.includes('水')) {
            throw new Error("First day header is wrong: " + firstDayTh.innerText);
        }
        if (!lastDayTh.innerText.includes('5/26') || !lastDayTh.innerText.includes('火')) {
            throw new Error("Last day header is wrong: " + lastDayTh.innerText);
        }

        // 検証3: 既存のサンプルデータ（鈴木美咲の5日目有、10日目休等）が完全にクリアされたか！
        const st2_d5 = staffList[1].days[4];
        const st2_d10 = staffList[1].days[9];
        log("7. Old sample check: Staff 2 day 5='" + st2_d5 + "', day 10='" + st2_d10 + "'");
        if (st2_d5 !== '' || st2_d10 !== '') {
            throw new Error("Old sample data was NOT cleared! Day5=" + st2_d5 + ", Day10=" + st2_d10);
        }

        // 検証4: 取り込んだデータ（佐藤健一の休・有）だけが正しく反映されているか
        const st1_d3 = staffList[0].days[2];
        const st1_d4 = staffList[0].days[3];
        log("8. Imported data check: Staff 1 day 3='" + st1_d3 + "', day 4='" + st1_d4 + "'");
        if (st1_d3 !== '休' || st1_d4 !== '有') {
            throw new Error("Imported data not applied!");
        }

        document.getElementById('test-log').innerText = "SUCCESS_ALL_TESTS_PASSED\n" + logs.join("\n");

    } catch (e) {
        document.getElementById('test-log').innerText = "ERROR: " + e.message + "\n" + logs.join("\n");
    }
});
</script>
</body>
</html>
'@

[System.IO.File]::WriteAllText($testHtml, $htmlContent, [System.Text.Encoding]::UTF8)

$dumpOut = Join-Path $here 'temp_dump_period_sync.txt'
& $edge --headless --virtual-time-budget=5000 --dump-dom $testHtml | Out-File -Encoding utf8 $dumpOut

$dump = [System.IO.File]::ReadAllText($dumpOut, [System.Text.Encoding]::UTF8)
if ($dump -match 'id="test-log">(.*?)</div>') {
    Write-Output $matches[1]
} else {
    Write-Output $dump.Substring(0, [Math]::Min(1000, $dump.Length))
}
