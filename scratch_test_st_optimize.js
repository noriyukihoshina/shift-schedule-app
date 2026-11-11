const fs = require('fs');
const solverCode = fs.readFileSync('solver.js', 'utf-8');
const vm = require('vm');
const sandbox = { console, require, module: {}, exports: {}, window: {} };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(solverCode, sandbox);

const staffList = [];
for (let i = 1; i <= 36; i++) {
    const floor = (i <= 4) ? '1F' : ((i <= 8) ? '2F' : ((i <= 12) ? '3F' : ((i <= 16) ? '南' : '')));
    const canSched = (i === 1 || i === 2 || i === 5 || i === 6 || i === 9 || i === 10 || i === 13 || i === 14);
    const isSectionChief = (i === 1);
    const isSubChief = (i === 5 || i === 9 || i === 13);
    const isFullTime = (i === 3 || i === 8 || i === 12 || i === 16);
    const isHalf = (i === 2);
    staffList.push({
        id: i,
        name: 'ST ' + String(i).padStart(2, '0'),
        isUnused: (i > 16),
        floor: floor,
        section: '',
        can8: false,
        noEarly: false,
        noLate: true,
        noEve: true,
        canSched: canSched,
        isSectionChief: isSectionChief,
        isChief: false,
        isSubChief: isSubChief,
        isHalf: isHalf,
        isZeroCount: false,
        isFirstYear: false,
        lifeSection: '',
        haSection: '',
        jobTitle: '',
        isFullTime: isFullTime,
        allow6Consec: false,
        isSatSunOff: false,
        isSunOff: false,
        prevName: '',
        remarks: '',
        prevDays: ['', '', '', '', ''],
        days: new Array(28).fill('')
    });
}

const scheduler = new sandbox.ShiftScheduler(staffList, { isST: true, deptId: 'st', standardHolidays: 8, numDays: 28 });
const result = scheduler.solveST({ assignSpecial: true });

const getSTRealWork = (s, d) => {
    const sym = scheduler.grid[s][d].symbol;
    if (!sandbox.isWorkSymbol(sym)) return 0.0;
    if (staffList[s].isZeroCount) return 0.0;
    if (staffList[s].isHalf || sym.includes('/')) return 0.5;
    return 1.0;
};

// スワップによる実数平準化ロジックのプロトタイプ
function optimizeSTRealWork(fl) {
    const floorStaff = [];
    for (let s = 0; s < scheduler.numStaff; s++) {
        if (!staffList[s].isUnused && staffList[s].floor === fl) {
            floorStaff.push(s);
        }
    }
    if (floorStaff.length <= 1) return;

    for (let iter = 0; iter < 100; iter++) {
        const dailyLoads = [];
        for (let d = 0; d < 28; d++) {
            let rSum = 0;
            floorStaff.forEach(s => { rSum += getSTRealWork(s, d); });
            dailyLoads.push({ d, rSum });
        }
        dailyLoads.sort((a, b) => b.rSum - a.rSum);

        const high = dailyLoads[0];
        const low = dailyLoads[dailyLoads.length - 1];
        if (high.rSum - low.rSum <= 0.5) {
            console.log(`[${fl}] Converged to spread <= 0.5 at iter ${iter}!`);
            break;
        }

        let swapped = false;
        // high.d に出勤、low.d に休みの 1.0 スタッフを探す
        for (const s of floorStaff) {
            if (staffList[s].isHalf) continue; // 1.0スタッフを動かす
            if (scheduler.grid[s][high.d].isFixed || scheduler.grid[s][low.d].isFixed) continue;
            
            const symHigh = scheduler.grid[s][high.d].symbol;
            const symLow = scheduler.grid[s][low.d].symbol;
            if (!sandbox.isWorkSymbol(symHigh) || symLow !== '休') continue;

            // スケ可チェック: high.d から s が抜けても残りのスケ可がいるか
            if (staffList[s].canSched) {
                let remSched = 0;
                floorStaff.forEach(oS => {
                    if (oS !== s && staffList[oS].canSched && sandbox.isWorkSymbol(scheduler.grid[oS][high.d].symbol)) {
                        remSched++;
                    }
                });
                if (remSched < 1) continue;
            }

            // 仮スワップ
            const newSymLow = (symHigh === '早') ? '早' : '○';
            scheduler.grid[s][high.d] = { symbol: '休', isFixed: false };
            scheduler.grid[s][low.d] = { symbol: newSymLow, isFixed: false };

            // 制約検証（連勤・公休間隔・早番翌日休）
            if (scheduler.isStaffHardValid(s)) {
                swapped = true;
                break;
            } else {
                scheduler.grid[s][high.d] = { symbol: symHigh, isFixed: false };
                scheduler.grid[s][low.d] = { symbol: symLow, isFixed: false };
            }
        }
        if (!swapped) {
            console.log(`[${fl}] Could not swap directly at iter ${iter}, spread: ${high.rSum - low.rSum}`);
            break;
        }
    }
}

optimizeSTRealWork('1F');

const floor1Real = [];
for (let d = 0; d < 28; d++) {
    let rSum = 0;
    for (let s = 0; s < 4; s++) rSum += getSTRealWork(s, d);
    floor1Real.push(rSum);
}
console.log('1F Optimized Real:', floor1Real.join(' '));
const minR = Math.min(...floor1Real);
const maxR = Math.max(...floor1Real);
console.log('1F Final Min:', minR, 'Max:', maxR, 'Spread:', maxR - minR);
