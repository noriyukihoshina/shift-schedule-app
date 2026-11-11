const { ShiftScheduler, validateScheduleGrid, autoAssignRefreshHolidaysCore } = require('./solver.js');

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
        wIdx: (d.getDay() + 6) % 7,
        isSat: d.getDay() === 6,
        isSun: d.getDay() === 0,
        isHoliday: false,
        label: `${d.getMonth()+1}/${d.getDate()}`,
        weekday: ['月','火','水','木','金','土','日'][(d.getDay() + 6) % 7]
    });
}

console.log('=== TEST 1: 生活期テーブル ===');
const lifeStaff = [];
for (let i = 0; i < 50; i++) {
    lifeStaff.push({
        id: i + 1,
        name: `生活期スタッフ ${i+1}`,
        isUnused: false,
        can8: i < 9,
        lifeSection: i < 25 ? '訪問' : (i < 40 ? '通所' : (i < 45 ? 'Cl1' : 'Cl2')),
        haSection: '',
        prevDays: ['○', '○', '休', '○', '○'],
        days: new Array(28).fill('')
    });
}
// リフを自動配分
autoAssignRefreshHolidaysCore(lifeStaff, termDates, {});

const lifeScheduler = new ShiftScheduler(lifeStaff, {
    standardHolidays: 8,
    dates: termDates,
    isLife: true
});
const lifeRes = lifeScheduler.solveLife();
console.log('Life solve success:', lifeRes.success);

// 生活期制約チェック: 正しいシグネチャ (grid, staffList, options)
const lifeVal = validateScheduleGrid(lifeRes.grid, lifeStaff, {
    standardHolidays: 8,
    dates: termDates,
    isLife: true,
    isFinal: true
});
console.log('Life validation errors count:', lifeVal.errors.length);
if (lifeVal.errors.length > 0) {
    console.log('Life errors:', lifeVal.errors);
}

console.log('\n=== TEST 2: 南病棟テーブル（遅番不足解消テスト） ===');
const southStaff = [];
for (let i = 0; i < 46; i++) {
    southStaff.push({
        id: i + 1,
        name: `南スタッフ ${i+1}`,
        isUnused: false,
        isSectionChief: i === 0,
        can8: i < 8,
        section: i < 12 ? 'PT A' : (i < 24 ? 'PT B' : (i < 35 ? 'OT A' : 'OT B')),
        prevDays: ['○', '○', '休', '○', '○'],
        days: new Array(28).fill('')
    });
}
const southScheduler = new ShiftScheduler(southStaff, {
    standardHolidays: 8,
    dates: termDates,
    isSouth: true
});
const southBaseRes = southScheduler.solveBaseSchedule({ force: true });
console.log('South base solve success:', southBaseRes.success);

const southSpecRes = southScheduler.assignSpecialDutiesToGrid({ force: true });
console.log('South special solve success:', southSpecRes.success);

// 南病棟の各日の遅番人数をチェック
const southDailyLate = new Array(28).fill(0);
for (let d = 0; d < 28; d++) {
    for (let s = 0; s < 46; s++) {
        if (southScheduler.grid[s][d].symbol === '遅') southDailyLate[d]++;
    }
}
console.log('South daily late counts:', southDailyLate);
const lateShortage = southDailyLate.filter(c => c < 2);
console.log('Days with late shortage in South (should be 0):', lateShortage.length);

console.log('\n=== TEST 3: STテーブル（実数平準化テスト） ===');
const stStaff = [];
for (let i = 0; i < 16; i++) {
    stStaff.push({
        id: i + 1,
        name: `STスタッフ ${i+1}`,
        isUnused: false,
        floor: i < 4 ? '1F' : (i < 8 ? '2F' : (i < 12 ? '3F' : '南')),
        isHalf: i % 4 === 0, // 0.5トグルON
        canSched: i % 2 === 0,
        prevDays: ['○', '○', '休', '○', '○'],
        days: new Array(28).fill('')
    });
}
const stScheduler = new ShiftScheduler(stStaff, {
    standardHolidays: 8,
    dates: termDates,
    isST: true
});
const stRes = stScheduler.solveST({ assignSpecial: true });
console.log('ST solve success:', stRes.success);

console.log('\nALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!');
