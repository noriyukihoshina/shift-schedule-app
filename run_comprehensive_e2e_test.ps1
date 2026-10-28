$dir = Split-Path -Parent $MyInvocation.MyCommand.Path

$testHtml = @'
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>E2E Comprehensive Verification</title>
</head>
<body>
    <div id="results" style="font-family:monospace; white-space:pre;"></div>
    <script src="solver.js?v=20261029_rev59"></script>
    <script>
    const resEl = document.getElementById('results');
    function log(msg) {
        resEl.innerText += msg + '\n';
        console.log(msg);
    }

    let allPassed = true;
    function assert(cond, name) {
        if (cond) {
            log('  [PASS] ' + name);
        } else {
            log('  [FAIL] ' + name);
            allPassed = false;
        }
    }

    try {
        log('=== TEST 1: ShiftScheduler Definition Check ===');
        assert(typeof ShiftScheduler === 'function', 'ShiftScheduler is defined as a class/function');

        log('\n=== TEST 2: ST Floor Sched Coverage Constraint Check ===');
        // ST初期スタッフ36名（1〜16番が実スタッフ、各階4名）
        const createSTStaff = () => {
            const list = [];
            const floors = ['1F', '2F', '3F', '南'];
            for (let i = 1; i <= 36; i++) {
                const fIdx = Math.floor((i - 1) / 4);
                list.push({
                    id: i,
                    name: `ST ${String(i).padStart(2, '0')}`,
                    floor: (i <= 16) ? floors[fIdx] : '',
                    isUnused: (i > 16),
                    canSched: (i <= 16 && (i % 4 === 1 || i % 4 === 2)), // 1F: 1,2 / 2F: 5,6 / 3F: 9,10 / 南: 13,14
                    isSectionChief: (i === 1),
                    isChief: (i === 2),
                    isSubChief: false,
                    isHalf: false,
                    isFullTime: (i === 3 || i === 7),
                    noEarly: false,
                    allow6Consec: false,
                    prevName: '',
                    prevDays: ['', '', '', '', ''],
                    days: new Array(28).fill('')
                });
            }
            return list;
        };

        const dates = [];
        const bDate = new Date('2026-04-01T00:00:00');
        for (let d = 0; d < 28; d++) {
            const dt = new Date(bDate);
            dt.setDate(dt.getDate() + d);
            dates.push({
                date: dt,
                label: `${dt.getMonth() + 1}/${dt.getDate()}`,
                weekday: ['日', '月', '火', '水', '木', '金', '土'][dt.getDay()],
                wIdx: (dt.getDay() + 6) % 7,
                isHoliday: false
            });
        }

        // 2-1: 2階（No.5, No.6）のスケ可をOFFにした場合にエラーになるか検証
        const stStaffNo2FSched = createSTStaff();
        stStaffNo2FSched[4].canSched = false; // No.5
        stStaffNo2FSched[5].canSched = false; // No.6

        const sched2FMissing = new ShiftScheduler(stStaffNo2FSched, {
            standardHolidays: 8.0,
            dates: dates,
            isST: true
        });
        const resMissing = sched2FMissing.solveBaseSchedule();
        assert(resMissing.success === false, 'Scheduler detects missing canSched staff on floor');
        const has2FError = resMissing.errors && resMissing.errors.some(e => e.includes('2階') && e.includes('スケ可'));
        assert(has2FError === true, 'Error message explicitly mentions 2階 and スケ可: ' + (resMissing.errors ? resMissing.errors.join(' | ') : 'none'));

        // 2-2: 各階にスケ可が1名以上いる場合、正常に成功するか検証
        const stStaffValid = createSTStaff();
        const schedValid = new ShiftScheduler(stStaffValid, {
            standardHolidays: 8.0,
            dates: dates,
            isST: true
        });
        const resValid = schedValid.solveBaseSchedule();
        assert(resValid.success === true, 'ST Schedule succeeds when all 4 floors have canSched staff');
        assert(resValid.grid && resValid.grid.length === 36, 'Grid has 36 staff rows');

        log('\n=== TEST 3: ST Output Table Rendering Check ===');
        // ST出力テーブルの階別描画テスト
        const stFloors = [
            { key: '1F', label: '1階' },
            { key: '2F', label: '2階' },
            { key: '3F', label: '3階' },
            { key: '南', label: '南' }
        ];
        let totalRenderedStaff = 0;
        stFloors.forEach(fl => {
            const floorStaff = stStaffValid.filter(s => !s.isUnused && (s.floor === fl.key || s.floor === fl.label));
            totalRenderedStaff += floorStaff.length;
        });
        assert(totalRenderedStaff === 16, 'All 16 active ST staff belong to one of 4 floors');

        // 各フロアで毎日スケ可スタッフが1名以上出勤しているか
        let floorCoverageOk = true;
        stFloors.forEach(fl => {
            const flStaffIndices = [];
            stStaffValid.forEach((s, idx) => {
                if (!s.isUnused && s.floor === fl.key && s.canSched) flStaffIndices.push(idx);
            });
            for (let d = 0; d < 28; d++) {
                let workCount = 0;
                flStaffIndices.forEach(sIdx => {
                    const sym = resValid.grid[sIdx][d].symbol;
                    if (sym === '○' || sym === '早') workCount++;
                });
                if (workCount < 1) {
                    floorCoverageOk = false;
                    log(`    Warning: Floor ${fl.key} has 0 canSched on day ${d+1}`);
                }
            }
        });
        assert(floorCoverageOk === true, 'Each of the 4 floors has at least 1 canSched staff working every day');

        log('\n=== TEST 4: PO Wards Schedule Check (ShiftScheduler is defined & solver works) ===');
        // POテーブル（48名運用、60名枠）のテスト
        const poStaffList = [];
        for (let i = 1; i <= 60; i++) {
            poStaffList.push({
                id: i,
                name: `スタッフ ${String(i).padStart(2, '0')}`,
                floor: '1F',
                isUnused: (i > 48),
                canSched: (i % 5 === 1 || i % 5 === 2),
                can8: (i % 6 === 3),
                isSectionChief: (i === 1),
                isChief: (i === 2),
                isSubChief: (i === 3 || i === 4),
                section: (i <= 24 ? 'PT A' : 'OT A'),
                isHalf: false,
                isFullTime: (i === 5 || i === 6 || i === 7),
                noEarly: false,
                noLate: false,
                noEve: false,
                allow6Consec: false,
                prevName: '',
                prevDays: ['', '', '', '', ''],
                days: new Array(28).fill('')
            });
        }
        const poScheduler = new ShiftScheduler(poStaffList, {
            standardHolidays: 8.0,
            dates: dates,
            isST: false
        });
        const poRes = poScheduler.solveBaseSchedule();
        assert(poRes.success === true, 'PO solveBaseSchedule succeeded without errors');
        assert(poRes.grid && poRes.grid.length === 60, 'PO grid has 60 staff rows');

        log('\n=== SUMMARY ===');
        if (allPassed) {
            log('ALL TESTS PASSED! 100% SUCCESS');
        } else {
            log('SOME TESTS FAILED');
        }

    } catch (err) {
        log('EXCEPTION: ' + err.stack);
        allPassed = false;
    }
    </script>
</body>
</html>
'@

$testPath = Join-Path $dir "test_e2e_verification.html"
[System.IO.File]::WriteAllText($testPath, $testHtml, [System.Text.Encoding]::UTF8)

$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$outPath = Join-Path $dir "test_e2e_out.txt"
$proc = Start-Process -FilePath $edgePath -ArgumentList "--headless", "--disable-gpu", "--virtual-time-budget=5000", "--dump-dom", "`"file:///$testPath`"" -NoNewWindow -PassThru -RedirectStandardOutput $outPath
$proc.WaitForExit(10000)

$content = [System.IO.File]::ReadAllText($outPath, [System.Text.Encoding]::UTF8)
Write-Output $content
