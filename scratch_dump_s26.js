const { ShiftScheduler, autoAssignRefreshHolidaysCore } = require('./solver.js');

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

const lifeStaff = [];
for (let i = 0; i < 50; i++) {
    lifeStaff.push({
        id: i + 1,
        name: `生活期スタッフ ${i+1}`,
        isUnused: false,
        can8: i < 9,
        lifeSection: i < 25 ? '訪問' : (i < 40 ? '通所' : (i < 45 ? 'Cl1' : 'Cl2')),
        haSection: '',
        prevDays: ['○', '○', '休', '○', '○'],
        days: new Array(28).fill('')
    });
}
autoAssignRefreshHolidaysCore(lifeStaff, termDates, {});

const lifeScheduler = new ShiftScheduler(lifeStaff, {
    standardHolidays: 8,
    dates: termDates,
    isLife: true
});
lifeScheduler.solveLife();

// スタッフ26の第1週のシンボルを確認
const s26 = lifeScheduler.grid[26].map(c => c.symbol);
console.log('Staff 27 grid:', s26.slice(0, 10));
