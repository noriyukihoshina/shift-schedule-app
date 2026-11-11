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

for (let d = 0; d < 28; d++) {
    const syms = [0, 1, 2, 3].map(s => stScheduler.grid[s][d].symbol);
    const r = (sandbox.isWorkSymbol(syms[0]) ? 1 : 0) + (sandbox.isWorkSymbol(syms[1]) ? 0.5 : 0) + (sandbox.isWorkSymbol(syms[2]) ? 1 : 0) + (sandbox.isWorkSymbol(syms[3]) ? 1 : 0);
    if (r > 2.5) {
        console.log(`Day ${d}: real=${r}, syms=${syms.join(',')}`);
    }
}
