// test_solver_term29.js
const solver = require('./solver.js');

console.log('--- 1. Testing SYMBOLS.EXCLUDE ---');
console.log('SYMBOLS.EXCLUDE:', solver.SYMBOLS.EXCLUDE);
if (solver.SYMBOLS.EXCLUDE !== 'ー') throw new Error('EXCLUDE symbol is not ー');

console.log('--- 2. Testing 29-day term (Term 13) ---');
const NUM_DAYS = 29;
const NUM_STAFF = 20;
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

const dates = [];
let curDate = new Date(2027, 2, 3); // 2027年3月3日 (水曜日)
for (let d = 0; d < NUM_DAYS; d++) {
    const dt = new Date(curDate);
    dt.setDate(curDate.getDate() + d);
    dates.push({
        m: dt.getMonth() + 1,
        day: dt.getDate(),
        w: WEEKDAYS[dt.getDay()],
        wIdx: dt.getDay(),
        weekday: WEEKDAYS[dt.getDay()]
    });
}
console.log(`Generated ${dates.length} days: ${dates[0].m}/${dates[0].day} (${dates[0].w}) ~ ${dates[dates.length-1].m}/${dates[dates.length-1].day} (${dates[dates.length-1].w})`);

// スタッフリストの作成
const staffList = [];
for (let i = 0; i < NUM_STAFF; i++) {
    const days = new Array(NUM_DAYS).fill('');
    // スタッフ 0: 前半14日間が「ー」（異動）
    if (i === 0) {
        for (let d = 0; d < 14; d++) days[d] = 'ー';
    }
    // スタッフ 1: 係長（平日月〜金出勤）
    // スタッフ 2: 主任
    // スタッフ 3: 副主任
    staffList.push({
        id: `s_${i+1}`,
        name: `スタッフ ${String(i + 1).padStart(2, '0')}`,
        section: i < 10 ? 'A' : 'B',
        isSectionChief: (i === 1),
        isChief: (i === 2),
        isSubChief: (i === 3),
        isHalf: (i === 4),
        isFullTime: (i < 8),
        can8: (i < 5),
        allow6Consec: false,
        days: days,
        prevDays: ['', '', '', '', '']
    });
}

console.log('--- 3. Testing validateInitialState with 29 days ---');
const valResult = solver.validateInitialState(staffList, { dates, numDays: 29 });
console.log('Validation errors:', valResult.errors);
console.log('Validation conflict cells:', valResult.conflictCells);
if (valResult.errors.length > 0) throw new Error('Unexpected validation errors');

console.log('--- 4. Testing ShiftScheduler with 29 days & standardHolidays = 8.5 ---');
const dayOffsets = new Array(NUM_DAYS).fill(0);
const scheduler = new solver.ShiftScheduler(staffList, {
    dates,
    numDays: 29,
    standardHolidays: 8.5,
    dayOffsets
});

console.log('Scheduler numDays:', scheduler.numDays);
console.log('Scheduler grid size:', scheduler.grid.length, 'x', scheduler.grid[0].length);
if (scheduler.numDays !== 29 || scheduler.grid[0].length !== 29) {
    throw new Error(`Grid size mismatch: numDays=${scheduler.numDays}, rowLen=${scheduler.grid[0].length}`);
}

console.log('Solving schedule...');
const result = scheduler.solve();
console.log('Solve success:', result.success);

const stats = scheduler.calculateStats(result.grid);
console.log('Stats calculated successfully!');
console.log('Staff 0 (Transferred,前半「ー」):');
console.log('  Work days:', stats.staffStats[0].workDays);
console.log('  Off days:', stats.staffStats[0].offDays);
console.log('  Row symbols for staff 0 (first 16):', result.grid[0].slice(0, 16).map(c => c.symbol).join(' '));

// スタッフ0の前半がすべて「ー」であることを確認
for (let d = 0; d < 14; d++) {
    if (result.grid[0][d].symbol !== 'ー') {
        throw new Error(`Staff 0 day ${d} was overwritten: ${result.grid[0][d].symbol}`);
    }
}

console.log('SUCCESS: All solver tests for 29 days and EXCLUDE passed cleanly!');
