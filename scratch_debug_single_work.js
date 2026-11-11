const fs = require('fs');
const { ShiftScheduler } = require('./solver.js');

const lifeStaff = [];
for (let i = 1; i <= 35; i++) {
    const isUnused = (i > 31);
    let sec = '訪問';
    let isSunOff = false;
    let isSatSunOff = false;

    if (i >= 1 && i <= 15) {
        sec = '訪問';
    } else if (i >= 16 && i <= 25) {
        sec = '通所';
        isSunOff = true;
    } else if (i === 28 || i === 29) {
        sec = 'Cl1';
    } else if (i === 30 || i === 31) {
        sec = 'Cl2';
        isSunOff = true;
    }

    lifeStaff.push({
        id: i,
        name: (i === 30 ? 'クラーク通所' : (i === 31 ? 'クラーク通所2' : `スタッフ ${String(i).padStart(2, '0')}`)),
        isUnused: isUnused,
        lifeSection: sec,
        isSatSunOff: isSatSunOff,
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

for (let s = 0; s < 31; s++) {
    for (let d = 1; d < 27; d++) {
        if (lifeRes.grid[s][d].symbol === '○' && lifeRes.grid[s][d-1].symbol === '休' && lifeRes.grid[s][d+1].symbol === '休') {
            console.log(`Staff ${lifeStaff[s].name} at day ${d+1} (${dates[d].day}日, wIdx=${dates[d].wIdx}): 休 ○ 休`);
            console.log("  Full schedule:", lifeRes.grid[s].map(c => c.symbol).join(' '));
        }
    }
}
