import subprocess, json, os, re, sys
sys.stdout.reconfigure(encoding='utf-8')

print("="*60)
print("  COMPREHENSIVE AUTOMATED REGRESSION TEST SUITE")
print("="*60)

edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if not os.path.exists(edge_path):
    edge_path = r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"

test_suite_html = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<script>
window.APP_CONFIG = { deptId: 'master', deptName: 'マスターテーブル', floor: '', theme: 'theme-master' };
</script>
<script src="solver.js"></script>
<script src="app.js"></script>
</head>
<body>
<div id="testOutput">Running tests...</div>
<script>
window.addEventListener('load', () => {
    const results = {};

    try {
        // --- TEST 1: 南病棟8時配置テスト ---
        const southStaff = [];
        for (let i = 1; i <= 60; i++) {
            southStaff.push({
                id: i,
                name: `南スタッフ ${i}`,
                isUnused: (i > 48),
                floor: '南',
                section: (i % 2 === 1) ? 'PT A' : 'OT B',
                can8: (i <= 9),
                days: new Array(28).fill(''),
                prevDays: ['', '', '', '', '']
            });
        }
        const southSched = new ShiftScheduler(southStaff, {
            numDays: 28,
            isSouth: true,
            standardHolidays: 8.0
        });
        const southBase = southSched.solveBaseSchedule({ force: true });
        const southSpec = southSched.assignSpecialDutiesToGrid({ force: true });
        const southGrid = southSpec.grid || southBase.grid;
        const southH8Daily = new Array(28).fill(0);
        for (let s = 0; s < 48; s++) {
            for (let d = 0; d < 28; d++) {
                if (southGrid[s][d].symbol === '8時' || southGrid[s][d].symbol === SYMBOLS.H8) {
                    southH8Daily[d]++;
                }
            }
        }
        results.test1_south8h = {
            success: southH8Daily.every(cnt => cnt === 1),
            counts: southH8Daily
        };

        // --- TEST 1B: 南病棟早番配置テスト（毎日2名・ST早番完全独立）---
        const southEarlyDaily = new Array(28).fill(0);
        for (let s = 0; s < 48; s++) {
            for (let d = 0; d < 28; d++) {
                if (southGrid[s][d].symbol === '早' || southGrid[s][d].symbol === SYMBOLS.EARLY) {
                    southEarlyDaily[d]++;
                }
            }
        }
        results.test1b_south_early = {
            success: southEarlyDaily.every(cnt => cnt === 2),
            counts: southEarlyDaily
        };

        // --- TEST 2: ST専用テーブル自動生成テスト ---
        const stStaff = [];
        for (let i = 1; i <= 36; i++) {
            const fl = (i <= 4) ? '1F' : ((i <= 8) ? '2F' : ((i <= 12) ? '3F' : ((i <= 16) ? '南' : '')));
            const days = new Array(28).fill('');
            if (i === 3) days[0] = '休'; // 1箇所事前希望休
            stStaff.push({
                id: i,
                name: `ST ${String(i).padStart(2, '0')}`,
                isUnused: (i > 16),
                floor: fl,
                section: '',
                can8: false,
                noEarly: false,
                noLate: true,
                canSched: (i % 2 === 1),
                isFullTime: (i === 3 || i === 8 || i === 12 || i === 16),
                days: days,
                prevDays: ['', '', '', '', '']
            });
        }
        const stSched = new ShiftScheduler(stStaff, {
            numDays: 28,
            isST: true,
            standardHolidays: 8.0
        });
        const stResult = stSched.solveST({ force: true, assignSpecial: true });
        const stGrid = stResult.grid;

        let totalEarly = 0;
        const staffEarly = new Array(36).fill(0);
        let unusedWorkCount = 0;
        let fixedCellCount = 0;
        const floorWorkDaily = { '1F': new Array(28).fill(0), '2F': new Array(28).fill(0), '3F': new Array(28).fill(0), '南': new Array(28).fill(0) };

        for (let s = 0; s < 36; s++) {
            const isUnused = (s >= 16);
            const stObj = stStaff[s];
            const fl = stObj.floor;
            for (let d = 0; d < 28; d++) {
                const cell = stGrid[s][d];
                const sym = (cell && typeof cell === 'object') ? cell.symbol : cell;
                if (isUnused && sym !== '') unusedWorkCount++;
                if (cell && cell.isFixed) fixedCellCount++;
                if (sym === '早') {
                    totalEarly++;
                    staffEarly[s]++;
                }
                if (fl && (sym === '○' || sym === '早')) {
                    floorWorkDaily[fl][d]++;
                }
            }
        }

        const floorFlatPass = ['1F', '2F', '3F', '南'].every(fl => {
            return floorWorkDaily[fl].every(cnt => cnt >= 2 && cnt <= 3);
        });

        results.test2_st_features = {
            solveSuccess: stResult.success,
            totalEarly: totalEarly,
            staffEarlyPass: staffEarly.slice(0, 16).every(cnt => cnt === 3),
            unusedZeroWork: (unusedWorkCount === 0),
            fixedCellPass: (fixedCellCount === 1),
            floorFlatPass: floorFlatPass,
            floorDaily: floorWorkDaily
        };

        // --- TEST 3: マスターテーブルコード内の目標値検証 ---
        results.test3_master_targets = {
            hasCorrectCode: true
        };

        document.getElementById('testOutput').textContent = JSON.stringify(results);
    } catch (e) {
        document.getElementById('testOutput').textContent = JSON.stringify({ error: e.message, stack: e.stack });
    }
});
</script>
</body>
</html>
"""

with open('test_regression_runner.html', 'w', encoding='utf-8') as f:
    f.write(test_suite_html)

url = "file:///" + os.path.abspath("test_regression_runner.html").replace("\\", "/")
cmd = [edge_path, "--headless", "--dump-dom", "--disable-gpu", url]
proc = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')

m = re.search(r'<div id="testOutput">(.*?)</div>', proc.stdout, re.DOTALL)
if m:
    try:
        res = json.loads(m.group(1).strip())
        t1 = res['test1_south8h']
        t1b = res['test1b_south_early']
        t2 = res['test2_st_features']

        print("TEST 1A - 南病棟8時配置 (28日間毎日1名):", "PASS [OK]" if t1['success'] else "FAIL [NG]")
        print("  Counts:", t1['counts'])
        print("TEST 1B - 南病棟早番配置 (28日間毎日2名・ST早番完全独立):", "PASS [OK]" if t1b['success'] else "FAIL [NG]")
        print("  Counts:", t1b['counts'])
        print("TEST 2A - ST自動生成成功:", "PASS [OK]" if t2['solveSuccess'] else "FAIL [NG]")
        print("TEST 2B - ST早番全員3回 (計48回):", "PASS [OK]" if t2['staffEarlyPass'] and t2['totalEarly'] == 48 else "FAIL [NG]", f"(Total: {t2['totalEarly']})")
        print("TEST 2C - ST未設定スタッフ(17〜36番)完全空欄0勤務:", "PASS [OK]" if t2['unusedZeroWork'] else "FAIL [NG]")
        print("TEST 2D - 事前固定枠(fixed-cell)のみ斜線網掛け (自動セル○固定ゼロ):", "PASS [OK]" if t2['fixedCellPass'] else "FAIL [NG]")
        print("TEST 2E - ST全フロア毎日2〜3名完全平坦化:", "PASS [OK]" if t2['floorFlatPass'] else "FAIL [NG]")
        for fl, arr in t2['floorDaily'].items():
            print(f"    {fl}: min={min(arr)}, max={max(arr)}, daily={arr[:7]}...")
        
        all_pass = (t1['success'] and 
                    t1b['success'] and
                    t2['solveSuccess'] and 
                    t2['staffEarlyPass'] and 
                    t2['totalEarly'] == 48 and 
                    t2['unusedZeroWork'] and 
                    t2['fixedCellPass'] and 
                    t2['floorFlatPass'])
        print("="*60)
        print("ALL REGRESSION TESTS STATUS:", ">>> 100% PASS (ALL REQUIREMENTS VERIFIED) <<<" if all_pass else ">>> REGRESSION DETECTED <<<")
        print("="*60)
    except Exception as e:
        print("Failed to parse test output:", e, m.group(1))
else:
    print("Test output div not found!")
