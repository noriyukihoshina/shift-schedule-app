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

// ステップ1: 事前特殊勤務の翌日休
scheduler.ensureHolidaysAfterPreAssignedSpecials();
// ステップ2: 公休割当
scheduler.assignHolidaysForST();
// ステップ2.5: 早番配置前に実数平準化スワップを実行！
scheduler.balanceWorkforceForST();
// ステップ3: 早番割当
scheduler.assignEarlyDutiesForST();
// ステップ4: スケ可保証
scheduler.ensureSchedCoverageForST();
// ステップ5: 最終平準化
scheduler.balanceWorkforceForST();

const getSTRealWork = (s, d) => {
    const sym = scheduler.grid[s][d].symbol;
    if (!sandbox.isWorkSymbol(sym)) return 0.0;
    if (staffList[s].isZeroCount) return 0.0;
    if (staffList[s].isHalf || sym.includes('/')) return 0.5;
    return 1.0;
};

const floor1Real = [];
const floor1Work = [];
for (let d = 0; d < 28; d++) {
    let rSum = 0;
    let wSum = 0;
    for (let s = 0; s < 4; s++) {
        rSum += getSTRealWork(s, d);
        if (sandbox.isWorkSymbol(scheduler.grid[s][d].symbol)) wSum++;
    }
    floor1Real.push(rSum);
    floor1Work.push(wSum);
}
console.log('1F Work:', floor1Work.join(' '));
console.log('1F Real:', floor1Real.join(' '));
const minR = Math.min(...floor1Real);
const maxR = Math.max(...floor1Real);
console.log('1F Min:', minR, 'Max:', maxR, 'Spread:', maxR - minR);
