const fs = require('fs');
const vm = require('vm');
const solverCode = fs.readFileSync('solver.js', 'utf-8');
const sandbox = { console, require, module: {}, exports: {}, window: {} };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(solverCode, sandbox);

const stStaff = [];
for (let i = 1; i <= 36; i++) {
    const floor = (i <= 4) ? '1F' : ((i <= 8) ? '2F' : ((i <= 12) ? '3F' : ((i <= 16) ? '南' : '')));
    const canSched = (i === 1 || i === 2 || i === 5 || i === 6 || i === 9 || i === 10 || i === 13 || i === 14);
    const isSectionChief = (i === 1);
    const isSubChief = (i === 5 || i === 9 || i === 13);
    const isFullTime = (i === 3 || i === 8 || i === 12 || i === 16);
    const isHalf = (i === 2);
    stStaff.push({
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
const stScheduler = new sandbox.ShiftScheduler(stStaff, { isST: true, deptId: 'st', standardHolidays: 8, numDays: 28 });
stScheduler.solveST({ assignSpecial: true });

// d=27 (3.5) のスタッフで、どこかの休を出勤にして d=27 を休にできるか
for (let s = 0; s < 4; s++) {
    for (let d = 0; d < 27; d++) {
        if (stScheduler.grid[s][d].symbol === '休') {
            stScheduler.setSymbol(s, 27, '休', false);
            stScheduler.setSymbol(s, d, '○', false);
            const ok = stScheduler.isStaffHardValid(s);
            if (ok) {
                console.log(`Staff ${s} can swap d=${d} (off->work) with d=27 (work->off)!`);
            }
            stScheduler.setSymbol(s, 27, '○', false);
            stScheduler.setSymbol(s, d, '休', false);
        }
    }
}
