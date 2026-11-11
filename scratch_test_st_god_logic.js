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
scheduler.assignHolidaysForST();

const getSTRealWork = (s, d) => {
    const sym = scheduler.grid[s][d].symbol;
    if (!sandbox.isWorkSymbol(sym)) return 0.0;
    if (staffList[s].isZeroCount) return 0.0;
    if (staffList[s].isHalf || sym.includes('/')) return 0.5;
    return 1.0;
};

// 神ロジック: 1.5の日と3.0の日のペアスワップ
function eliminateExtremesST(fl) {
    const floorStaff = [];
    for (let s = 0; s < scheduler.numStaff; s++) {
        if (!staffList[s].isUnused && staffList[s].floor === fl) {
            floorStaff.push(s);
        }
    }
    if (floorStaff.length <= 1) return;

    for (let iter = 0; iter < 100; iter++) {
        let improved = false;
        // 実数 3.0 の日（超過日）と 実数 1.5 の日（不足日）を探す
        const highDays = [];
        const lowDays = [];
        for (let d = 0; d < 28; d++) {
            let rSum = 0;
            floorStaff.forEach(s => { rSum += getSTRealWork(s, d); });
            if (rSum >= 2.75) highDays.push(d);
            else if (rSum <= 1.75) lowDays.push(d);
        }
        if (highDays.length === 0 || lowDays.length === 0) break;

        // 距離が近い順にペアを試す
        const pairs = [];
        for (const h of highDays) {
            for (const l of lowDays) {
                pairs.push({ h, l, dist: Math.abs(h - l) });
            }
        }
        pairs.sort((a, b) => a.dist - b.dist);

        for (const pair of pairs) {
            for (const s of floorStaff) {
                if (staffList[s].isHalf) continue; // 1.0スタッフを動かす
                if (scheduler.grid[s][pair.h].isFixed || scheduler.grid[s][pair.l].isFixed) continue;
                const symH = scheduler.grid[s][pair.h].symbol;
                const symL = scheduler.grid[s][pair.l].symbol;
                if (!sandbox.isWorkSymbol(symH) || symL !== '休') continue;

                // スケ可保護
                if (staffList[s].canSched) {
                    let remSched = 0;
                    floorStaff.forEach(oS => {
                        if (oS !== s && staffList[oS].canSched && sandbox.isWorkSymbol(scheduler.grid[oS][pair.h].symbol)) {
                            remSched++;
                        }
                    });
                    if (remSched < 1) continue;
                }

                scheduler.grid[s][pair.h] = { symbol: '休', isFixed: false };
                scheduler.grid[s][pair.l] = { symbol: (symH === '早' ? '早' : '○'), isFixed: false };

                if (scheduler.isStaffHardValid(s)) {
                    improved = true;
                    break;
                } else {
                    scheduler.grid[s][pair.h] = { symbol: symH, isFixed: false };
                    scheduler.grid[s][pair.l] = { symbol: symL, isFixed: false };
                }
            }
            if (improved) break;
        }
        if (!improved) break;
    }
}

eliminateExtremesST('1F');

// その後、早番やスケ可・専従を配置
scheduler.assignEarlyDutiesForST();
scheduler.ensureSchedCoverageForST();
scheduler.ensureFullTimeCoverageForST();

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
