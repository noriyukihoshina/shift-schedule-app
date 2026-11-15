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

// ユーザーが第3タームを生成し、その保存データを localStorage から読み取る状況
// app.js の collectPastRefreshHolidayHistory をシミュレート
console.log('=== ユーザー環境の再現 ===');

// 第3ターム（2026-05-27開始）
const staff3 = generateTestStaffList('1f');
const dates3 = getDates('2026-05-27');
const sched3 = new ShiftScheduler(staff3, { standardHolidays: 8.0, dates: dates3, dayOffsets: new Array(28).fill(0) });
sched3.solveBaseSchedule({});

// もし第3タームでスタッフ37, 39, 43, 44が何らかの理由で上1を取っていなかったら？
// （例えば手動希望休や事前入力があった、あるいは旧方式のバグで取れていなかった）
const userPastHistory = {};
for (let s = 0; s < 48; s++) {
    const id = staff3[s].id;
    // ユーザーの指摘: 37, 39, 43, 44は第3タームでも取っていない！
    if ([37, 39, 43, 44].includes(id)) continue;
    
    const refs = [];
    for (let d = 0; d < 28; d++) {
        const sym = sched3.grid[s][d].symbol;
        if (sym.startsWith('上') || sym.startsWith('下')) refs.push(sym);
    }
    if (refs.length > 0) userPastHistory[id] = refs;
}

console.log('userPastHistory 件数:', Object.keys(userPastHistory).length);

// 第4ターム生成
const staff4 = generateTestStaffList('1f');
const dates4 = getDates('2026-06-24');
const sched4 = new ShiftScheduler(staff4, { standardHolidays: 8.0, dates: dates4, dayOffsets: new Array(28).fill(0) });
sched4.solveBaseSchedule({ obtainedHistory: userPastHistory });

[37, 39, 43, 44].forEach(id => {
    const s = id - 1;
    const u1Days = [];
    const u2Days = [];
    for (let d = 0; d < 28; d++) {
        if (sched4.grid[s][d].symbol === '上1') u1Days.push(dates4[d].month + '/' + dates4[d].day);
        if (sched4.grid[s][d].symbol === '上2') u2Days.push(dates4[d].month + '/' + dates4[d].day);
    }
    console.log(`Staff ${id}: 上1=[${u1Days.join(',')}], 上2=[${u2Days.join(',')}]`);
});
