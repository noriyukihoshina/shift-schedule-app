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
const res = stScheduler.solveST({ assignSpecial: true });

console.log('ST Solve Success:', res.success);

const floors = ['1F', '2F', '3F', '南'];
floors.forEach(fl => {
    const fStaff = stStaff.filter(s => !s.isUnused && s.floor === fl).map(s => s.id - 1);
    const fReal = [];
    for (let d = 0; d < 28; d++) {
        let r = 0;
        fStaff.forEach(s => {
            const sym = stScheduler.grid[s][d].symbol;
            if (sandbox.isWorkSymbol(sym)) {
                r += (stStaff[s].isHalf ? 0.5 : 1.0);
            }
        });
        fReal.push(r);
    }
    const minR = Math.min(...fReal);
    const maxR = Math.max(...fReal);
    console.log(`[${fl}] Min: ${minR}, Max: ${maxR}, Spread: ${maxR - minR}, Has 1.5?: ${fReal.includes(1.5)}`);
});
