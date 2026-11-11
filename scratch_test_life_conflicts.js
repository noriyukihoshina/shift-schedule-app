const fs = require('fs');
const vm = require('vm');

const solverJs = fs.readFileSync('solver.js', 'utf-8');

const ctx = {
    console: console,
    module: { exports: {} },
    exports: {}
};
vm.createContext(ctx);
vm.runInContext(solverJs, ctx);

// 生活期のダミースタッフ（31名）
const staffList = [];
for (let i = 1; i <= 31; i++) {
    const s = {
        id: i,
        name: `スタッフ ${String(i).padStart(2, '0')}`,
        isUnused: false,
        can8: (i >= 5 && i <= 10), // スタッフ05〜10が8時可
        lifeSection: (i <= 20 ? '訪問' : (i <= 28 ? '通所' : 'Cl2')),
        isSatSunOff: (i <= 20), // 訪問は土日休
        isSunOff: (i > 20),
        days: new Array(28).fill(''),
        prevDays: ['', '', '', '', '']
    };
    staffList.push(s);
}

// 2026-04-01からの28日間
const dates = [];
const start = new Date('2026-04-01T00:00:00');
for (let d = 0; d < 28; d++) {
    const dt = new Date(start);
    dt.setDate(dt.getDate() + d);
    dates.push({
        dateObj: dt,
        label: `${dt.getMonth() + 1}/${dt.getDate()}`,
        m: dt.getMonth() + 1,
        day: dt.getDate(),
        weekday: ['日', '月', '火', '水', '木', '金', '土'][dt.getDay()],
        wIdx: dt.getDay() === 0 ? 6 : dt.getDay() - 1,
        isHoliday: false
    });
}

const scheduler = new ctx.ShiftScheduler(staffList, {
    dates: dates,
    isLife: true,
    standardHolidays: 8.0,
    dayOffsets: new Array(28).fill(0)
});

const res = scheduler.solveBaseSchedule();
console.log('Life solve result:', res.success);

const val = ctx.validateScheduleGrid(scheduler.grid, staffList, {
    dates: dates,
    isLife: true,
    standardHolidays: 8.0,
    isFinal: false
});

console.log('Errors count:', val.errors.length);
val.errors.forEach(err => console.log('ERROR:', err));
console.log('Conflict cells count:', val.conflictCells.length);
val.conflictCells.forEach(c => console.log('CONFLICT CELL:', c));
