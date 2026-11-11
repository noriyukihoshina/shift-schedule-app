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

// 賢いST実数平準化アルゴリズム
function smartBalanceST(fl) {
    const floorStaff = [];
    for (let s = 0; s < scheduler.numStaff; s++) {
        if (!staffList[s].isUnused && staffList[s].floor === fl) {
            floorStaff.push(s);
        }
    }
    if (floorStaff.length <= 1) return;

    for (let iter = 0; iter < 100; iter++) {
        let improved = false;
        const dailyLoads = [];
        for (let d = 0; d < 28; d++) {
            let rSum = 0;
            floorStaff.forEach(s => { rSum += getSTRealWork(s, d); });
            dailyLoads.push({ d, rSum });
        }

        const maxDayObj = dailyLoads.reduce((max, cur) => cur.rSum > max.rSum ? cur : max, dailyLoads[0]);
        const minDayObj = dailyLoads.reduce((min, cur) => cur.rSum < min.rSum ? cur : min, dailyLoads[0]);
        if (maxDayObj.rSum - minDayObj.rSum <= 0.5) break;

        // 実数超過日（最大日）群
        const highDays = dailyLoads.filter(x => x.rSum === maxDayObj.rSum);
        // 実数不足日（最小日）群
        const lowDays = dailyLoads.filter(x => x.rSum === minDayObj.rSum);

        // highDays と lowDays のペアを距離が近い順に試す
        const pairs = [];
        for (const h of highDays) {
            for (const l of lowDays) {
                pairs.push({ h: h.d, l: l.d, dist: Math.abs(h.d - l.d) });
            }
        }
        pairs.sort((a, b) => a.dist - b.dist);

        for (const pair of pairs) {
            for (const s of floorStaff) {
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

smartBalanceST('1F');

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
