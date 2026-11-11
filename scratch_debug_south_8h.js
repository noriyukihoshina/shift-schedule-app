const fs = require('fs');
const vm = require('vm');

const solverCode = fs.readFileSync('solver.js', 'utf8');
const win = {};
const sandbox = {
    console,
    window: win,
    Math,
    Array,
    Date,
    String,
    Number,
    Boolean,
    RegExp,
    Set,
    Map
};
vm.createContext(sandbox);
vm.runInContext(solverCode, sandbox);

const ShiftScheduler = win.ShiftScheduler;

const staffList = [];
for (let i = 1; i <= 44; i++) {
    staffList.push({
        id: i,
        name: `スタッフ ${String(i).padStart(2, '0')}`,
        floor: (i <= 22) ? '南2' : '南3',
        subFloor: (i <= 22) ? '南2' : '南3',
        isSectionChief: (i === 1),
        isChief: (i === 2),
        isSubChief: (i === 3 || i === 4),
        can8: (i >= 5 && i <= 14),
        canSched: (i >= 5 && i <= 10),
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
        wIdx: (dt.getDay() + 6) % 7,
        isHoliday: false
    });
}

const solver = new ShiftScheduler(staffList, {
    dates: dates,
    isSouth: true,
    standardHolidays: 8,
    isFinal: false
});

// 手動で assign8ClockDuties を呼び出して戻り値を確認
solver.assignHolidays();
const res = solver.assign8ClockDuties({ force: true });
console.log('assign8ClockDuties result:', res);
