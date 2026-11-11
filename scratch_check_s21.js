// チェック
const fs = require('fs');
const { ShiftScheduler } = require('./solver.js');

const lifeStaff = [];
for (let i = 1; i <= 35; i++) {
    const isUnused = (i > 31);
    let sec = (i <= 15 ? '訪問' : (i <= 25 ? '通所' : (i <= 29 ? 'Cl1' : 'Cl2')));
    let isSunOff = (sec === '通所' || sec === 'Cl2');
    lifeStaff.push({
        id: i,
        name: (i === 30 ? 'クラーク通所' : (i === 31 ? 'クラーク通所2' : `スタッフ ${String(i).padStart(2, '0')}`)),
        isUnused: isUnused,
        lifeSection: sec,
        isSatSunOff: false,
        isSunOff: isSunOff,
        can8: (i <= 5),
        prevDays: ['', '', '', '', ''],
        days: new Array(28).fill('')
    });
}
const dates = [];
for (let d = 1; d <= 28; d++) {
    const dateObj = new Date(2026, 3, d);
    const wIdx = (dateObj.getDay() + 6) % 7;
    dates.push({ day: d, wIdx: wIdx, isSunday: (wIdx === 6), isSaturday: (wIdx === 5) });
}
const lifeScheduler = new ShiftScheduler(lifeStaff, { standardHolidays: 8, dates: dates, isLife: true });
const lifeRes = lifeScheduler.solveLife();

const s21 = lifeRes.grid[20];
console.log("Day 25, 26, 27, 28 for staff 21:");
console.log("Day 25 (wIdx=" + dates[24].wIdx + "):", s21[24]);
console.log("Day 26 (wIdx=" + dates[25].wIdx + "):", s21[25]);
console.log("Day 27 (wIdx=" + dates[26].wIdx + "):", s21[26]);
console.log("Day 28 (wIdx=" + dates[27].wIdx + "):", s21[27]);
