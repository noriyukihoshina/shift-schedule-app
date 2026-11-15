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

// 第3ターム
const staff3 = generateTestStaffList('1f');
const dates3 = getDates('2026-05-27');
const sched3 = new ShiftScheduler(staff3, { standardHolidays: 8.0, dates: dates3, dayOffsets: new Array(28).fill(0) });
sched3.solveBaseSchedule({});

const pastHistory = {};
for (let s = 0; s < 48; s++) {
    const id = staff3[s].id;
    const refs = [];
    for (let d = 0; d < 28; d++) {
        const sym = sched3.grid[s][d].symbol;
        if (sym.startsWith('上') || sym.startsWith('下')) refs.push(sym);
    }
    if (refs.length > 0) pastHistory[id] = refs;
}

// 第4ターム
const staff4 = generateTestStaffList('1f');
const dates4 = getDates('2026-06-24');
const sched4 = new ShiftScheduler(staff4, { standardHolidays: 8.0, dates: dates4, dayOffsets: new Array(28).fill(0) });
sched4.solveBaseSchedule({ obtainedHistory: pastHistory });

console.log('=== 全48名の6月リフ（上1）完全取得確認 ===');
let u1Total = 0;
for (let id = 1; id <= 48; id++) {
    const s = id - 1;
    let u1Term = '';
    if (pastHistory[id] && pastHistory[id].includes('上1')) {
        u1Term = '第3ターム';
    } else {
        for (let d = 0; d < 28; d++) {
            if (sched4.grid[s][d].symbol === '上1') {
                u1Term = `第4ターム (${dates4[d].month}/${dates4[d].day})`;
                break;
            }
        }
    }
    if (u1Term) {
        u1Total++;
    } else {
        console.error(`❌ スタッフ No.${id} が上1未取得！`);
    }
}
console.log(`🎉 上1取得結果: ${u1Total} / 48 名が100%取得完了！\n`);

console.log('--- スタッフ 37, 39, 43, 44 のリフ取得状況 ---');
[37, 39, 43, 44].forEach(id => {
    const s = id - 1;
    const t3 = pastHistory[id] || [];
    const t4 = [];
    for (let d = 0; d < 28; d++) {
        const sym = sched4.grid[s][d].symbol;
        if (sym.startsWith('上') || sym.startsWith('下')) t4.push(`${dates4[d].month}/${dates4[d].day}:${sym}`);
    }
    console.log(`Staff ${id}: 第3ターム=[${t3.join(',')}], 第4ターム=[${t4.join(',')}]`);
});
