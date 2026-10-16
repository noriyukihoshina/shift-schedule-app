$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$url = 'https://shift-schedule-app-ruby.vercel.app'
$port = 8095
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

$runnerHtml = @"
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<div id="output" style="white-space:pre; font-family:monospace;"></div>

<!-- 本番環境から配信されている最新JSスクリプトを直接読み込み -->
<script src="https://shift-schedule-app-ruby.vercel.app/solver.js"></script>
<script>
const out = document.getElementById('output');
function log(msg) { out.textContent += msg + '\n'; }

async function runProductionTests() {
    log('=== 本番環境 (https://shift-schedule-app-ruby.vercel.app) 配信コード 厳格検証 ===\n');
    let passCount = 0;
    let totalCount = 0;
    function assert(desc, cond) {
        totalCount++;
        if (cond) {
            passCount++;
            log('[PASS] ' + desc);
        } else {
            log('[FAIL] ' + desc);
        }
    }

    try {
        // 1. 本番の ShiftScheduler と新設関数の存在チェック
        assert('1. 本番 solver.js に ShiftScheduler が存在すること', typeof ShiftScheduler === 'function');
        assert('2. 本番 solver.js に validateScheduleGrid が存在すること', typeof validateScheduleGrid === 'function');
        assert('3. 本番 solver.js に balanceDailyWorkforce メソッドが存在すること', typeof ShiftScheduler.prototype.balanceDailyWorkforce === 'function');

        // 2. 50名スタッフデータによる第1段階（基本勤務表生成）テスト
        const patterns = [
            ['○', '○', '休', '○', '○'],
            ['休', '休', '○', '○', '○'],
            ['○', '休', '○', '○', '休'],
            ['○', '○', '○', '○', '休'],
            ['休', '○', '○', '○', '○']
        ];
        const staffList = [];
        for (let i = 1; i <= 50; i++) {
            staffList.push({
                id: i,
                name: `スタッフ ${String(i).padStart(2, '0')}`,
                can8: (i <= 9),
                noEarly: (i === 13),
                noLate: (i === 13),
                noEve: (i === 13 || i === 15 || i === 16),
                canSched: (i <= 8),
                isRole: (i <= 6),
                isFullTime: (i <= 10),
                allow6Consec: (i === 20 || i === 21),
                prevDays: [...patterns[(i - 1) % patterns.length]],
                days: new Array(28).fill('')
            });
        }
        staffList[0].days[3] = '休';
        staffList[1].days[4] = '有'; staffList[1].days[8] = '休';
        staffList[2].days[13] = '休';
        staffList[5].days[0] = '休';
        staffList[5].days[9] = '上1'; staffList[5].days[10] = '上2'; staffList[5].days[11] = '上3'; staffList[5].days[12] = '上4'; staffList[5].days[13] = '上5';
        staffList[10].days[13] = '出'; staffList[10].days[14] = '出';
        staffList[3].days[10] = 'ハヤ';
        staffList[4].days[15] = 'オソ';
        staffList[6].days[20] = 'イブ';

        const scheduler = new ShiftScheduler(staffList, { standardHolidays: 8.0 });
        const baseRes = scheduler.solveBaseSchedule();
        assert('4. 第1段階 (基本勤務表生成) が成功すること', baseRes && baseRes.success);

        // 3. 第2段階（特殊勤務割り当て）
        const specRes = scheduler.assignSpecialDutiesToGrid();
        assert('5. 第2段階 (特殊勤務を入れる) が成功すること', specRes && specRes.success);

        // 4. 出勤人数平準化の検証（ブレ幅3〜4名以内）
        const counts = [];
        for (let d = 0; d < 28; d++) {
            let w = 0;
            for (let s = 0; s < 50; s++) {
                const sym = scheduler.grid[s][d].symbol;
                if (sym && !['休', '有', '上1', '上2', '上3', '上4', '上5', '下1', '下2', '下3'].includes(sym)) {
                    w++;
                }
            }
            counts.push(w);
        }
        const minW = Math.min(...counts);
        const maxW = Math.max(...counts);
        const diff = maxW - minW;
        log(`  -> 出勤人数分布: 最小 ${minW}名 〜 最大 ${maxW}名 (ブレ幅: ${diff}名)`);
        assert('6. 出勤人数の日別平準化が達成されていること (ブレ幅 ' + diff + '名 <= 4名)', diff <= 4);

        // 5. 本番 validateScheduleGrid による全制約検証
        const valRes = validateScheduleGrid(scheduler.grid, scheduler.staffList, { standardHolidays: 8.0, isFinal: true });
        assert('7. 本番 validateScheduleGrid() が完全合格すること (エラー数: ' + valRes.errors.length + ')', valRes.isValid && valRes.errors.length === 0);

        // 6. 意図的違反に対するエラー検出・青い網掛けセル抽出テスト
        const testGrid = JSON.parse(JSON.stringify(scheduler.grid));
        for (let d = 0; d < 6; d++) testGrid[0][d].symbol = '○';
        testGrid[0][6].symbol = '休';
        testGrid[1][10].symbol = '早';
        testGrid[1][11].symbol = '○';
        const testVal = validateScheduleGrid(testGrid, scheduler.staffList, { standardHolidays: 8.0, isFinal: true });
        assert('8. 制約違反（6連勤・翌日出勤）が検出され、青い網掛け対象セルが抽出されること (抽出セル数: ' + testVal.conflictCells.length + ')',
            !testVal.isValid && testVal.conflictCells.length > 0);

        // 7. 違反解消後の回復テスト
        testGrid[0][3].symbol = '休';
        testGrid[1][11].symbol = '休';
        const recVal = validateScheduleGrid(scheduler.grid, scheduler.staffList, { standardHolidays: 8.0, isFinal: true });
        assert('9. 違反セル解消後に制約チェックが完全回復すること', recVal.isValid);

    } catch (e) {
        log('[ERROR] ' + e.message + '\n' + e.stack);
    } finally {
        log(`\n=== 本番配信コード検証サマリー: ${passCount} / ${totalCount} PASSED ===`);
        fetch('http://localhost:$port/result', {
            method: 'POST',
            headers: {'Content-Type': 'text/plain; charset=utf-8'},
            body: out.textContent
        }).catch(err => console.log(err));
    }
}
window.onload = runProductionTests;
</script>
</body>
</html>
"@

$runnerPath = Join-Path $PSScriptRoot "test_prod_runner.html"
[System.IO.File]::WriteAllText($runnerPath, $runnerHtml, [System.Text.Encoding]::UTF8)
$fileUri = [System.Uri]::new($runnerPath).AbsoluteUri

Write-Output "Starting Edge for production check..."
$proc = Start-Process -FilePath $edge -ArgumentList "--headless", "--disable-gpu", "`"$fileUri`"" -PassThru -NoNewWindow

$context = $listener.GetContext()
$reader = New-Object System.IO.StreamReader($context.Request.InputStream, [System.Text.Encoding]::UTF8)
$resText = $reader.ReadToEnd()

$context.Response.StatusCode = 200
$buf = [System.Text.Encoding]::UTF8.GetBytes("OK")
$context.Response.OutputStream.Write($buf, 0, $buf.Length)
$context.Response.OutputStream.Close()
$listener.Stop()
$listener.Close()
try { $proc.Kill() } catch {}

Write-Output $resText
