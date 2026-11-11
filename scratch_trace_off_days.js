const { ShiftScheduler } = require('./solver.js');

const termDates = [];
const start = new Date(2026, 4, 27);
for (let i = 0; i < 28; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    termDates.push({
        date: d,
        day: d.getDate(),
        month: d.getMonth() + 1,
        wIdx: (d.getDay() + 6) % 7,
        isSat: d.getDay() === 6,
        isSun: d.getDay() === 0,
        isHoliday: false
    });
}

const staff = {
    id: 27,
    name: 'スタッフ 27',
    isUnused: false,
    lifeSection: '通所',
    prevDays: ['○', '○', '休', '○', '○'],
    days: new Array(28).fill('')
};

const sc = new ShiftScheduler([staff], { standardHolidays: 8, dates: termDates, isLife: true });

// sc.weekSpans の各週について、何が起きたか追跡
sc.solveLife();
for (let d = 0; d < 28; d++) {
    if (sc.grid[0][d].symbol === '休') {
        const di = termDates[d];
        console.log(`Day ${d} (${di.month}/${di.day} wIdx=${di.wIdx}): 休`);
    }
}
