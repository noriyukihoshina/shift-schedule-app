const fs = require('fs');
const { ShiftScheduler, validateScheduleGrid, SYMBOLS } = require('./solver.js');

console.log("=== Testing South ST Early Rules ===");
const numDays = 28;
const staffList = [];
for (let i = 0; i < 36; i++) {
    const isS2 = (i < 18);
    const localIdx = isS2 ? i : (i - 18);
    staffList.push({
        id: `s_${i}`,
        name: `スタッフ${i+1}`,
        jobTitle: (i % 2 === 0) ? 'PT' : 'OT',
        section: isS2 ? ((i % 2 === 0) ? 'PT 2' : 'OT 2') : ((i % 2 === 0) ? 'PT 3' : 'OT 3'),
        isFirstYear: (localIdx < 3),
        canSched: (localIdx >= 3 && localIdx < 7),
        can8: (localIdx >= 7 && localIdx < 10),
        isSectionChief: false,
        isUnused: false,
        noEarly: false,
        noLate: false,
        noEve: false,
        prevDays: ['', '', '', '', ''],
        days: new Array(numDays).fill('')
    });
}

// STスタッフのモックデータ:
// Day 0 (4/1): ST早番 0名 -> PO南2: 1名, PO南3: 1名 (PO計2名)
// Day 1 (4/2): ST早番 1名 -> PO南2: 1名かつPO南3: 0名、またはPO南2: 0名かつPO南3: 1名 (PO計1名)
// Day 2 (4/3): ST早番 2名 -> STは1名のみ充当されるため、POは1名配置されること (PO計1名)
const stDailyEarly = new Array(numDays).fill(0);
stDailyEarly[1] = 1;
stDailyEarly[2] = 2;

const mockStStaffData = {
    staffList: [
        { id: 'st_1', name: 'ST1', isUnused: false, days: new Array(numDays).fill('') },
        { id: 'st_2', name: 'ST2', isUnused: false, days: new Array(numDays).fill('') }
    ],
    grid: [
        new Array(numDays).fill({ symbol: '○' }),
        new Array(numDays).fill({ symbol: '○' })
    ]
};
mockStStaffData.grid[0][1] = { symbol: '早' }; // Day 1: ST1が早番
mockStStaffData.grid[0][2] = { symbol: '早' }; // Day 2: ST1が早番
mockStStaffData.grid[1][2] = { symbol: '早' }; // Day 2: ST2も早番

const scheduler = new ShiftScheduler(staffList, {
    numDays: numDays,
    standardHolidays: 8.0,
    isSouth: true,
    isFinal: true,
    stDailyEarly: stDailyEarly
});

const baseRes = scheduler.solveBaseSchedule();
console.log("Base Solve:", baseRes.success ? "OK" : "NG");
if (!baseRes.success) {
    console.error("Base errors:", baseRes.errors);
    process.exit(1);
}

const specialRes = scheduler.assignSpecialDutiesToGrid({ force: true });
console.log("Special Solve:", specialRes.success ? "OK" : "NG");
if (!specialRes.success) {
    console.error("Special errors:", specialRes.errors);
    process.exit(1);
}

const grid = specialRes.grid;
const getSub = (s) => (s < 18 ? '南2' : '南3');

// 検証:
// Day 0: ST 0名 -> PO南2: 1名, PO南3: 1名
let d0S2Early = 0, d0S3Early = 0;
for (let s = 0; s < 36; s++) {
    if (grid[s][0].symbol === SYMBOLS.EARLY) {
        if (getSub(s) === '南2') d0S2Early++; else d0S3Early++;
    }
}
console.log(`Day 0 (ST 0名): 南2早番=${d0S2Early}, 南3早番=${d0S3Early}`);
if (d0S2Early !== 1 || d0S3Early !== 1) {
    console.error("FAIL: Day 0 should have South2=1 and South3=1");
    process.exit(1);
}

// Day 1: ST 1名 -> PO南2と南3の一方が1名、もう一方が0名 (PO計1名)
let d1S2Early = 0, d1S3Early = 0;
for (let s = 0; s < 36; s++) {
    if (grid[s][1].symbol === SYMBOLS.EARLY) {
        if (getSub(s) === '南2') d1S2Early++; else d1S3Early++;
    }
}
console.log(`Day 1 (ST 1名): 南2早番=${d1S2Early}, 南3早番=${d1S3Early}, PO計=${d1S2Early + d1S3Early}`);
if ((d1S2Early + d1S3Early) !== 1) {
    console.error("FAIL: Day 1 should have PO early total = 1");
    process.exit(1);
}

// Day 2: ST 2名 -> ST充当は最大1名なので、PO早番は0名ではなく必ず1名配置されること！
let d2S2Early = 0, d2S3Early = 0;
for (let s = 0; s < 36; s++) {
    if (grid[s][2].symbol === SYMBOLS.EARLY) {
        if (getSub(s) === '南2') d2S2Early++; else d2S3Early++;
    }
}
console.log(`Day 2 (ST 2名): 南2早番=${d2S2Early}, 南3早番=${d2S3Early}, PO計=${d2S2Early + d2S3Early}`);
if ((d2S2Early + d2S3Early) !== 1) {
    console.error("FAIL: Day 2 should have PO early total = 1 even when ST early = 2");
    process.exit(1);
}

// 日付ラベル
const testDates = [];
for (let d = 0; d < numDays; d++) {
    testDates.push({ label: `4/${d + 1}`, m: 4, day: d + 1 });
}

// validateScheduleGrid のテスト
const valRes = validateScheduleGrid(grid, staffList, {
    dates: testDates,
    numDays: numDays,
    standardHolidays: 8.0,
    isSouth: true,
    isFinal: true,
    stStaffData: mockStStaffData
});

console.log("Validation Errors Count:", valRes.errors.length);
valRes.errors.forEach(err => console.log("  Validation msg:", err));

// Day 2 に ST 早番が2名いるため「同日2名は希望以外NG」の警告が出ていることを確認
const hasSt2Warning = valRes.errors.some(err => err.includes('同日2名は希望以外NG'));
console.log("ST 2名 Warning Detected:", hasSt2Warning ? "YES" : "NO");

if (hasSt2Warning && !valRes.errors.some(err => err.includes('早番要件を満たしていません'))) {
    console.log("=== ALL ST EARLY TESTS PASSED! ===");
} else {
    console.error("Validation logic test failed");
    process.exit(1);
}
