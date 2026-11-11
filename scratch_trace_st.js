const fs = require('fs');
const vm = require('vm');

const solverJs = fs.readFileSync('solver.js', 'utf-8');

const sandbox = {
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout
};
sandbox.window = sandbox;
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(solverJs, sandbox);

const stStaff = [];
for (let i = 1; i <= 16; i++) {
    const s = {
        id: i,
        name: `STスタッフ ${String(i).padStart(2, '0')}`,
        isUnused: false,
        floor: (i <= 4 ? '1F' : (i <= 8 ? '2F' : (i <= 12 ? '3F' : '南'))),
        canSched: (i % 4 === 1 || i % 4 === 2),
        days: new Array(28).fill(''),
        prevDays: ['', '', '', '', '']
    };
    if (i === 2) {
        s.days[19] = '上1';
    }
    stStaff.push(s);
}

const dates = [];
const start = new Date('2026-04-01T00:00:00');
for (let d = 0; d < 28; d++) {
    const dt = new Date(start);
    dt.setDate(dt.getDate() + d);
    const dayOfWeek = dt.getDay();
    dates.push({
        dateObj: dt,
        label: `${dt.getMonth() + 1}/${dt.getDate()}`,
        m: dt.getMonth() + 1,
        day: dt.getDate(),
        weekday: ['日', '月', '火', '水', '木', '金', '土'][dayOfWeek],
        wIdx: dayOfWeek === 0 ? 6 : dayOfWeek - 1,
        isHoliday: false
    });
}

const stSched = new sandbox.ShiftScheduler(stStaff, {
    dates: dates,
    isST: true,
    standardHolidays: 8.0,
    dayOffsets: new Array(28).fill(0)
});

console.log('--- Step by step trace for ST Staff 02 ---');
stSched.ensureHolidaysAfterPreAssignedSpecials();
console.log('After ensureHolidaysAfterPreAssignedSpecials:', countOff(stSched.grid[1]));

stSched.assignHolidaysForST();
console.log('After assignHolidaysForST:', countOff(stSched.grid[1]));

stSched.ensureSchedCoverageForST();
console.log('After ensureSchedCoverageForST:', countOff(stSched.grid[1]));

stSched.ensureFullTimeCoverageForST();
console.log('After ensureFullTimeCoverageForST:', countOff(stSched.grid[1]));

stSched.balanceWorkforceForST();
console.log('After balanceWorkforceForST:', countOff(stSched.grid[1]));

function countOff(row) {
    let off = 0, ref = 0, work = 0;
    row.forEach(c => {
        if (c.symbol === '休') off++;
        else if (c.symbol === '上1') ref++;
        else if (c.symbol === '○') work++;
    });
    return { off, ref, work, all: row.map(c => c.symbol).join(',') };
}
