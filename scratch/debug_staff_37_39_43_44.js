const { ShiftScheduler, autoAssignRefreshHolidaysCore, getTermRefreshGroups, SYMBOLS, isWorkSymbol } = require('../solver.js');

function generateStaffList() {
    const staffList = [];
    for (let i = 1; i <= 60; i++) {
        const isUnused = (i > 48);
        const section = (i <= 12 ? 'PT A' : (i <= 24 ? 'OT A' : (i <= 36 ? 'PT B' : 'OT B')));
        const can8 = ((i >= 2 && i <= 6) || (i >= 15 && i <= 19) || (i >= 28 && i <= 32) || (i >= 39 && i <= 43));
        staffList.push({
            id: i,
            name: `スタッフ ${String(i).padStart(2, '0')}`,
            isUnused: isUnused,
            floor: '1f',
            subFloor: (i <= 24 ? 'A' : 'B'),
            section: section,
            can8: can8,
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

// ターム日付生成
function getDates(startDateStr) {
    const dates = [];
    const [y, m, d] = startDateStr.split('-').map(Number);
    const start = new Date(y, m - 1, d);
    for (let i = 0; i < 28; i++) {
        const cur = new Date(start);
        cur.setDate(start.getDate() + i);
        const cy = cur.getFullYear();
        const cm = cur.getMonth() + 1;
        const cd = cur.getDate();
        const wIdx = cur.getDay();
        dates.push({
            year: cy,
            month: cm,
            day: cd,
            wIdx: wIdx,
            dateStr: `${cy}-${String(cm).padStart(2, '0')}-${String(cd).padStart(2, '0')}`,
            isSun: (wIdx === 0),
            isSat: (wIdx === 6),
            isHoliday: false
        });
    }
    return dates;
}

console.log('=== 第3ターム & 第4タームのリフ配分シミュレーション ===\n');

// 第3ターム: 5/27〜6/23 (または 5/26〜6/22)
// 6月期を含む
const datesTerm3 = getDates('2026-05-27');
console.log('第3ターム期間:', datesTerm3[0].dateStr, '〜', datesTerm3[27].dateStr);
const groupsTerm3 = getTermRefreshGroups(datesTerm3);
console.log('第3タームのリフグループ:', groupsTerm3.map(g => ({ symbol: g.symbol, daysInTerm: g.dayIndices.length, totalMonthDays: g.totalMonthDays })));

// 第4ターム: 6/24〜7/21
const datesTerm4 = getDates('2026-06-24');
console.log('第4ターム期間:', datesTerm4[0].dateStr, '〜', datesTerm4[27].dateStr);
const groupsTerm4 = getTermRefreshGroups(datesTerm4);
console.log('第4タームのリフグループ:', groupsTerm4.map(g => ({ symbol: g.symbol, daysInTerm: g.dayIndices.length, totalMonthDays: g.totalMonthDays })));

// 第3ターム実行
const staffTerm3 = generateStaffList();
const sched3 = new ShiftScheduler(staffTerm3, {
    standardHolidays: 8.0,
    dates: datesTerm3,
    dayOffsets: new Array(28).fill(0)
});
const res3 = sched3.solveBaseSchedule({});
console.log('\n第3ターム solveBaseSchedule 成功:', res3.success);

const pastHistoryTerm4 = {};
for (let s = 0; s < 48; s++) {
    const refs = [];
    for (let d = 0; d < 28; d++) {
        const sym = sched3.grid[s][d].symbol;
        if (sym === '上1' || sym === '上2') refs.push(sym);
    }
    if (refs.length > 0) {
        pastHistoryTerm4[staffTerm3[s].id] = refs;
    }
}

// 第4ターム実行
const staffTerm4 = generateStaffList();
const sched4 = new ShiftScheduler(staffTerm4, {
    standardHolidays: 8.0,
    dates: datesTerm4,
    dayOffsets: new Array(28).fill(0)
});
const res4 = sched4.solveBaseSchedule({
    obtainedHistory: pastHistoryTerm4
});
console.log('第4ターム solveBaseSchedule 成功:', res4.success);

const targetStaffIds = [37, 39, 43, 44];
console.log('\n--- スタッフ 37, 39, 43, 44 のリフ取得状況 ---');
targetStaffIds.forEach(id => {
    const sIdx = id - 1;
    let ref3 = [];
    let ref4 = [];
    for (let d = 0; d < 28; d++) {
        const sym3 = sched3.grid[sIdx][d].symbol;
        if (sym3.startsWith('上') || sym3.startsWith('下')) ref3.push(`${datesTerm3[d].dateStr}:${sym3}`);
        const sym4 = sched4.grid[sIdx][d].symbol;
        if (sym4.startsWith('上') || sym4.startsWith('下')) ref4.push(`${datesTerm4[d].dateStr}:${sym4}`);
    }
    console.log(`スタッフ No.${id}: 第3ターム=[${ref3.join(', ')}], 第4ターム=[${ref4.join(', ')}]`);
});

// 全スタッフのリフ取得状況一覧
console.log('\n--- 第3タームおよび第4タームでのリフ取得人数 ---');
let t3Count = 0;
let t4Count = 0;
let bothCount = 0;
let neitherCount = [];

for (let s = 0; s < 48; s++) {
    const id = s + 1;
    let has3 = false;
    let has4 = false;
    for (let d = 0; d < 28; d++) {
        const sym3 = sched3.grid[s][d].symbol;
        if (sym3.startsWith('上') || sym3.startsWith('下')) has3 = true;
        const sym4 = sched4.grid[s][d].symbol;
        if (sym4.startsWith('上') || sym4.startsWith('下')) has4 = true;
    }
    if (has3) t3Count++;
    if (has4) t4Count++;
    if (has3 && has4) bothCount++;
    if (!has3 && !has4) neitherCount.push(id);
}
console.log(`第3ターム取得者数: ${t3Count} 名 / 48名`);
console.log(`第4ターム取得者数: ${t4Count} 名 / 48名`);
console.log(`両方取得者数: ${bothCount} 名`);
console.log(`両方未取得者 (${neitherCount.length}名):`, neitherCount);
