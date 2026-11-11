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

// 手動で assignHolidaysForST の中の処理を再現
const floors = ['1F', '2F', '3F', '南'];
const stdHols = 8.0;

const basePatterns = [
    [0, 3, 7, 10, 14, 17, 21, 24],
    [2, 5, 9, 12, 16, 19, 23, 26],
    [1, 4, 8, 11, 15, 18, 22, 25],
    [3, 6, 10, 13, 17, 20, 24, 27]
];

const floorStaff = [0, 1, 2, 3]; // 1Fの4名
const s = 1; // スタッフ02
const idxInFloor = 1;
const pattern = basePatterns[1];
const targetDays = pattern.map(d => (d + 0) % 28);

console.log('Initial grid row 1 (staff 02):');
console.log(stSched.grid[1].map((c, idx) => `${idx}:${c.symbol || 'empty'}(fixed:${c.isFixed})`).join(' '));

let currentOff = 0;
for (let d = 0; d < 28; d++) {
    const sym = stSched.grid[s][d].symbol;
    if (stSched.grid[s][d].isExcluded) continue;
    if (sandbox.isHolidaySymbol(sym)) currentOff += 1.0;
    else if (sandbox.isHalfDuty(sym)) currentOff += 0.5;
}
console.log('currentOff before targetDays:', currentOff);

targetDays.forEach(d => {
    if (currentOff >= stdHols) return;
    if (stSched.grid[s][d].isFixed || stSched.grid[s][d].symbol !== '') {
        console.log(`targetDay ${d} skipped because isFixed=${stSched.grid[s][d].isFixed}, symbol=${stSched.grid[s][d].symbol}`);
        return;
    }
    stSched.setSymbol(s, d, '休', false);
    currentOff++;
});

console.log('currentOff after targetDays:', currentOff);

while (currentOff < stdHols) {
    let bestDay = -1;
    let bestFloorLoad = -999;
    for (let d = 0; d < 28; d++) {
        if (stSched.grid[s][d].isFixed || stSched.grid[s][d].symbol !== '') continue;
        let flLoad = 0;
        floorStaff.forEach(oS => {
            if (!sandbox.isHolidaySymbol(stSched.grid[oS][d].symbol)) flLoad++;
        });
        if (flLoad > bestFloorLoad) {
            bestFloorLoad = flLoad;
            bestDay = d;
        }
    }
    console.log(`while loop: bestDay=${bestDay}, bestFloorLoad=${bestFloorLoad}`);
    if (bestDay >= 0) {
        stSched.setSymbol(s, bestDay, '休', false);
        currentOff++;
    } else {
        break;
    }
}
console.log('currentOff after while loop:', currentOff);
