const fs = require('fs');
const vm = require('vm');

const solverCode = fs.readFileSync('solver.js', 'utf8');
const win = {};
const sandbox = { console, window: win, Math, Array, Date, String, Number, Boolean, RegExp, Set, Map };
vm.createContext(sandbox);
vm.runInContext(solverCode, sandbox);

const ShiftScheduler = win.ShiftScheduler;

const staffList = [];
for (let i = 1; i <= 20; i++) {
    staffList.push({
        id: i,
        name: `スタッフ ${String(i).padStart(2, '0')}`,
        floor: '1F',
        subFloor: '1F',
        section: '1F',
        can8: (i >= 5 && i <= 12), // 8名が8時可能
        canSched: true,
        days: new Array(28).fill(''),
        prevDays: ['', '', '', '', '']
    });
}

const dates = [];
for (let d = 0; d < 28; d++) {
    const dt = new Date(2026, 3, 1 + d);
    dates.push({
        dIndex: d,
        label: `${dt.getMonth() + 1}/${dt.getDate()}`,
        dayOfWeek: dt.getDay()
    });
}

const reqs = {
    '1F': { early: 1, late: 1, eShift: 1, h8: 1 }
};

const scheduler = new ShiftScheduler(staffList, dates, reqs, '1F');
const result = scheduler.generate();

console.log('--- 8h Staff Breakdown ---');
let total8 = 0;
for (let i = 4; i < 12; i++) {
    const s = staffList[i];
    const d8 = s.days.filter(x => x === '8時').length;
    const early = s.days.filter(x => x === '早').length;
    const late = s.days.filter(x => x === '遅').length;
    const e = s.days.filter(x => x === 'E').length;
    total8 += d8;
    console.log(`${s.name}: 8時=${d8}, 早=${early}, 遅=${late}, E=${e}, 早遅E合計=${early+late+e}`);
}
console.log(`Total 8h: ${total8} / 28`);

console.log('\n--- General Staff (No 8h) Sample Breakdown ---');
for (let i = 12; i < 18; i++) {
    const s = staffList[i];
    const d8 = s.days.filter(x => x === '8時').length;
    const early = s.days.filter(x => x === '早').length;
    const late = s.days.filter(x => x === '遅').length;
    const e = s.days.filter(x => x === 'E').length;
    console.log(`${s.name}: 8時=${d8}, 早=${early}, 遅=${late}, E=${e}, 早遅E合計=${early+late+e}`);
}
