const fs = require('fs');
const solver = require('../solver.js');
const ShiftScheduler = solver.ShiftScheduler;
const autoAssignRefreshHolidaysCore = solver.autoAssignRefreshHolidaysCore;

// 第4ターム (2026/6/24 - 7/21, 28日間)
const numDays = 28;
const dates = [];
const start = new Date(2026, 5, 24); // 6/24
for (let i = 0; i < numDays; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push({
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        date: d.getDate(),
        day: d.getDate(),
        dayOfWeek: ['日','月','火','水','木','金','土'][d.getDay()],
        wIdx: d.getDay(),
        isSat: d.getDay() === 6,
        isSun: d.getDay() === 0,
        label: (d.getMonth()+1) + '/' + d.getDate()
    });
}

// 46名
const staffList = [];
for (let i = 1; i <= 46; i++) {
    const idx = i - 1;
    const st = {
        id: i,
        name: 'スタッフ ' + i,
        section: idx < 12 ? 'PT A' : (idx < 24 ? 'PT B' : (idx < 36 ? 'OT A' : 'OT B')),
        isSectionChief: i === 1,
        isChief: i === 2 || i === 13,
        isSubChief: i === 3 || i === 14 || i === 26 || i === 37,
        can8: idx < 9,
        canSched: idx < 8,
        isFullTime: idx < 10,
        allow6Consec: i === 20 || i === 21,
        days: new Array(numDays).fill(''),
        prevDays: ['○', '○', '○', '○', '休']
    };
    staffList.push(st);
}

// リフレッシュ自動配分
console.log('--- 1. Auto assign refresh holidays ---');
const refRes = autoAssignRefreshHolidaysCore(staffList, dates, {});
console.log('Assigned ref count:', refRes.assignedCount);
if (refRes.assignments) {
    refRes.assignments.forEach(a => {
        console.log('Staff ' + a.staffId + ' (' + a.symbol + ') on day ' + a.dayIndex + ' (' + dates[a.dayIndex].label + ')');
    });
}

// スケジューラー実行
console.log('--- 2. Scheduler solveBaseSchedule ---');
const scheduler = new ShiftScheduler(staffList, {
    dates: dates,
    standardHolidays: 8.0,
    numDays: numDays
});

const res = scheduler.solveBaseSchedule();
console.log('Solve success:', res.success);
if (!res.success) {
    console.log('Errors count:', res.errors.length);
    res.errors.forEach(e => console.log('  ', e));
} else {
    console.log('Solve succeeded cleanly!');
}
