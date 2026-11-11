const { ShiftScheduler } = require('./solver.js');

// 2026年第3ターム（2026-05-27 〜 2026-06-23）
const termDates = [];
const start = new Date(2026, 4, 27); // 5/27
for (let i = 0; i < 28; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    termDates.push({
        date: d,
        day: d.getDate(),
        month: d.getMonth() + 1,
        wIdx: (d.getDay() + 6) % 7, // 0:月 ... 6:日
        isSat: d.getDay() === 6,
        isSun: d.getDay() === 0,
        isHoliday: false
    });
}

// 生活期スタッフ作成（50名）
const staffList = [];
for (let i = 0; i < 50; i++) {
    staffList.push({
        id: i + 1,
        name: `スタッフ ${i+1}`,
        isUnused: false,
        can8: i < 9, // 1〜9番目8時可
        lifeSection: i < 25 ? '訪問' : '通所',
        haSection: '',
        days: new Array(28).fill('')
    });
}

const scheduler = new ShiftScheduler(staffList, {
    standardHolidays: 8,
    dates: termDates,
    isLife: true
});

const res = scheduler.solveLife();
console.log('Success:', res.success);

// 各日の8時人数をチェック
const h8Counts = new Array(28).fill(0);
for (let d = 0; d < 28; d++) {
    for (let s = 0; s < 50; s++) {
        if (res.grid[s][d].symbol === '8時') h8Counts[d]++;
    }
}
console.log('8h counts:', h8Counts);

// 平日で8時が0名の日があるか？
let shortageDays = [];
for (let d = 0; d < 28; d++) {
    const di = termDates[d];
    if (di.wIdx !== 5 && di.wIdx !== 6) {
        if (h8Counts[d] === 0) shortageDays.push(d);
    }
}
console.log('Shortage weekdays:', shortageDays);
