const { ShiftScheduler, getTermRefreshGroups } = require('../solver.js');

function generateTestStaffList(floorType) {
    const staffList = [];
    for (let i = 1; i <= 60; i++) {
        const isUnused = (i > 48);
        staffList.push({
            id: i,
            name: `スタッフ ${String(i).padStart(2, '0')}`,
            isUnused: isUnused,
            floor: floorType,
            section: (i <= 12 ? 'PT A' : (i <= 24 ? 'OT A' : (i <= 36 ? 'PT B' : 'OT B'))),
            can8: ((i >= 2 && i <= 6) || (i >= 15 && i <= 19) || (i >= 28 && i <= 32) || (i >= 39 && i <= 43)),
            noEarly: false,
            noLate: false,
            noEve: false,
            canSched: (i <= 8),
            isSectionChief: (i === 1),
            isChief: (i === 2 || i === 3),
            isSubChief: (i === 4 || i === 5),
            isHalf: false,
            isZeroCount: false,
            isFirstYear: false,
            isFullTime: (i <= 10),
            allow6Consec: false,
            isSatSunOff: false,
            isSunOff: false,
            prevDays: new Array(7).fill(''),
            days: new Array(28).fill('')
        });
    }
    return staffList;
}

function getDates(startDateStr) {
    const dates = [];
    const [y, m, d] = startDateStr.split('-').map(Number);
    const start = new Date(y, m - 1, d);
    for (let i = 0; i < 28; i++) {
        const cur = new Date(start);
        cur.setDate(start.getDate() + i);
        dates.push({
            year: cur.getFullYear(),
            month: cur.getMonth() + 1,
            day: cur.getDate(),
            wIdx: cur.getDay(),
            isSun: (cur.getDay() === 0),
            isSat: (cur.getDay() === 6)
        });
    }
    return dates;
}

const staff3 = generateTestStaffList('1f');
const dates3 = getDates('2026-05-27');
const sched3 = new ShiftScheduler(staff3, { standardHolidays: 8.0, dates: dates3, dayOffsets: new Array(28).fill(0) });
sched3.solveBaseSchedule({});

const pastHistory = {};
for (let s = 0; s < 48; s++) {
    const refs = [];
    for (let d = 0; d < 28; d++) {
        const sym = sched3.grid[s][d].symbol;
        if (sym.startsWith('上') || sym.startsWith('下')) refs.push(sym);
    }
    if (refs.length > 0) pastHistory[staff3[s].id] = refs;
}

const staff4 = generateTestStaffList('1f');
const dates4 = getDates('2026-06-24');
const sched4 = new ShiftScheduler(staff4, { standardHolidays: 8.0, dates: dates4, dayOffsets: new Array(28).fill(0) });
sched4.solveBaseSchedule({ skipAutoRefresh: true });

const unobtainedU1 = [];
for (let id = 1; id <= 48; id++) {
    if (!pastHistory[id] || !pastHistory[id].includes('上1')) {
        unobtainedU1.push(id);
    }
}
console.log('第3ターム時点で上1未取得のスタッフ (' + unobtainedU1.length + '名):', unobtainedU1.join(', '));

// 各スタッフの 6/24〜6/30 の勤務記号
console.log('\n未取得スタッフの第4ターム 0〜6日目（6/24〜6/30）の勤務記号:');
unobtainedU1.forEach(id => {
    const s = id - 1;
    const syms = [];
    for (let d = 0; d <= 6; d++) {
        syms.push(sched4.grid[s][d].symbol);
    }
    console.log(`Staff ${String(id).padStart(2)}: ${syms.join(', ')}`);
});

// 第4タームで実際に配分を実行してみる
sched4.assignAutoRefreshHolidaysToGrid({ obtainedHistory: pastHistory });

console.log('\n第4ターム配分後の未取得スタッフの記号:');
unobtainedU1.forEach(id => {
    const s = id - 1;
    const u1Days = [];
    const u2Days = [];
    for (let d = 0; d < 28; d++) {
        if (sched4.grid[s][d].symbol === '上1') u1Days.push(dates4[d].month + '/' + dates4[d].day);
        if (sched4.grid[s][d].symbol === '上2') u2Days.push(dates4[d].month + '/' + dates4[d].day);
    }
    console.log(`Staff ${String(id).padStart(2)}: 上1=[${u1Days.join(',')}], 上2=[${u2Days.join(',')}]`);
});
