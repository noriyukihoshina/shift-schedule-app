const fs = require('fs');
const vm = require('vm');

const solverCode = fs.readFileSync('solver.js', 'utf8');
const win = {};
const sandbox = { console, window: win, Math, Array, Date, String, Number, Boolean, RegExp, Set, Map };
vm.createContext(sandbox);
vm.runInContext(solverCode, sandbox);
const ShiftScheduler = win.ShiftScheduler;

// 1階のスタッフリストを作成
const staffList1F = [];
for (let i = 1; i <= 20; i++) {
    staffList1F.push({
        id: i,
        name: `スタッフ ${String(i).padStart(2, '0')}`,
        floor: '1F',
        subFloor: '1F',
        section: (i <= 10) ? 'PT A' : 'PT B',
        isSectionChief: (i === 1),
        isChief: (i === 2),
        isSubChief: (i === 3 || i === 4),
        can8: (i >= 5 && i <= 8),
        canSched: true,
        days: new Array(28).fill(''),
        prevDays: ['', '', '', '', '']
    });
}

const dates = [];
for (let d = 0; d < 28; d++) {
    const dt = new Date(2026, 3, 1 + d);
    const jsDay = dt.getDay();
    const wIdx = (jsDay + 6) % 7;
    dates.push({
        dIndex: d,
        label: `${dt.getMonth() + 1}/${dt.getDate()}`,
        wIdx: wIdx,
        isHoliday: (wIdx === 5 || wIdx === 6)
    });
}

const scheduler = new ShiftScheduler(staffList1F, {
    dates: dates,
    standardHolidays: 8,
    isFinal: false
});

scheduler.solve({ force: true });
scheduler.assignSpecialDutiesToGrid({ force: true });

const s1 = staffList1F[0];
const s1Days = scheduler.grid[0].map(c => c.symbol);
console.log('Staff 01 days:', s1Days.join(' '));
const offCount = s1Days.filter(x => x === '休').length;
console.log('Staff 01 off count:', offCount);

// 全スタッフの公休数を確認
for (let i = 0; i < staffList1F.length; i++) {
    const off = scheduler.grid[i].filter(c => c.symbol === '休').length;
    if (off !== 8) {
        console.log(`Staff ${i+1} (${staffList1F[i].name}): off=${off}`);
    }
}
