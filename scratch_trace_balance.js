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

const floorStaff = [0, 1, 2, 3];
const getSTRealWork = (s, d) => {
    const sym = scheduler.grid[s][d].symbol;
    if (!sandbox.isWorkSymbol(sym)) return 0.0;
    if (staffList[s].isZeroCount) return 0.0;
    if (staffList[s].isHalf || sym.includes('/')) return 0.5;
    return 1.0;
};

const dailyLoads = [];
for (let d = 0; d < 28; d++) {
    let realSum = 0;
    floorStaff.forEach(s => { realSum += getSTRealWork(s, d); });
    dailyLoads.push({ d, realSum });
}
dailyLoads.sort((a, b) => b.realSum - a.realSum);

const maxDay = dailyLoads[0];
const minDay = dailyLoads[dailyLoads.length - 1];
console.log('maxDay:', maxDay, 'minDay:', minDay);

for (const s of floorStaff) {
    const symMax = scheduler.grid[s][maxDay.d].symbol;
    const symMin = scheduler.grid[s][minDay.d].symbol;
    console.log(`Staff ${s}: maxDay(${maxDay.d})=${symMax}, minDay(${minDay.d})=${symMin}`);
    if (symMax !== '○' || symMin !== '休') {
        console.log(`  -> skipped: symMax!==○ or symMin!==休`);
        continue;
    }
    if (staffList[s].canSched) {
        let remSched = 0;
        floorStaff.forEach(oS => {
            if (oS !== s && staffList[oS].canSched && sandbox.isWorkSymbol(scheduler.grid[oS][maxDay.d].symbol)) remSched++;
        });
        if (remSched < 1) {
            console.log(`  -> skipped: remSched < 1`);
            continue;
        }
    }
    scheduler.setSymbol(s, maxDay.d, '休', false);
    scheduler.setSymbol(s, minDay.d, '○', false);
    const valid = scheduler.isStaffHardValid(s);
    console.log(`  -> isStaffHardValid: ${valid}`);
    scheduler.setSymbol(s, maxDay.d, symMax, false);
    scheduler.setSymbol(s, minDay.d, symMin, false);
}
