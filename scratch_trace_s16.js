const fs = require('fs');
const { ShiftScheduler } = require('./solver.js');

const lifeStaff = [{
    id: 16,
    name: 'スタッフ 16',
    isUnused: false,
    lifeSection: '通所',
    isSunOff: true,
    prevDays: ['', '', '', '', ''],
    days: new Array(28).fill('')
}];

const dates = [];
for (let d = 1; d <= 28; d++) {
    const dateObj = new Date(2026, 3, d);
    const wIdx = (dateObj.getDay() + 6) % 7;
    dates.push({ day: d, wIdx: wIdx, isSunday: (wIdx === 6), isSaturday: (wIdx === 5) });
}

const lifeScheduler = new ShiftScheduler(lifeStaff, { standardHolidays: 8, dates: dates, isLife: true });
const lifeRes = lifeScheduler.solveLife();
console.log("Before eliminate, staff 16 schedule:");
console.log(lifeRes.grid[0].map((c, idx) => `${idx+1}:${c.symbol}`).join(' '));
