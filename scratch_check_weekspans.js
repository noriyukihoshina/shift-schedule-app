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

const scheduler = new ShiftScheduler([], { dates: termDates });
console.log('weekSpans:', scheduler.weekSpans);
