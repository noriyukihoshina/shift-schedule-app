// verify_final_comprehensive.js
const fs = require('fs');
const path = require('path');
const solver = require('./solver.js');

console.log('=== COMPREHENSIVE SYSTEM VERIFICATION ===\n');

// 1. Check solver.js SYMBOLS
console.log('1. Checking solver.js SYMBOLS...');
if (solver.SYMBOLS.EXCLUDE !== 'ー') throw new Error('SYMBOLS.EXCLUDE is not ー');
console.log('  -> EXCLUDE symbol verified: "ー"');

// 2. Check 28-day & 29-day solver solving
console.log('\n2. Checking ShiftScheduler solving for 28-day and 29-day terms...');
[28, 29].forEach(numDays => {
    const dates = [];
    let cur = new Date(2026, 3, 1);
    for (let d = 0; d < numDays; d++) {
        const dt = new Date(cur);
        dt.setDate(cur.getDate() + d);
        dates.push({ m: dt.getMonth() + 1, day: dt.getDate(), wIdx: dt.getDay() });
    }

    const staffList = [];
    for (let i = 0; i < 20; i++) {
        const days = new Array(numDays).fill('');
        if (i === 0) {
            for (let d = 0; d < 14; d++) days[d] = 'ー';
        }
        staffList.push({
            id: `s_${i+1}`,
            name: `スタッフ ${String(i+1).padStart(2, '0')}`,
            section: i < 10 ? 'A' : 'B',
            isSectionChief: (i === 1),
            isChief: (i === 2),
            isSubChief: (i === 3),
            isHalf: (i === 4),
            isFullTime: (i < 8),
            can8: (i < 5),
            allow6Consec: false,
            days,
            prevDays: ['', '', '', '', '']
        });
    }

    const stdHols = (numDays === 29) ? 8.5 : 8.0;
    const scheduler = new solver.ShiftScheduler(staffList, {
        dates,
        numDays,
        standardHolidays: stdHols,
        dayOffsets: new Array(numDays).fill(0)
    });

    const res = scheduler.solve();
    if (!res.success) throw new Error(`Solver failed for ${numDays} days!`);
    const stats = scheduler.calculateStats(res.grid);
    console.log(`  -> ${numDays}-day term solved successfully! (stdHols=${stdHols}, staff[0] transferred workDays=${stats.staffStats[0].workDays}, offDays=${stats.staffStats[0].offDays})`);
});

// 3. Check SectionChief absent conflict cell detection
console.log('\n3. Checking SectionChief absent conflict cell detection (Blue highlight)...');
{
    const staffList = [
        { name: '係長', isSectionChief: true, isUnused: false, days: new Array(28).fill(''), prevDays: ['', '', '', '', ''] },
        { name: '主任', isChief: true, isUnused: false, days: new Array(28).fill(''), prevDays: ['', '', '', '', ''] }
    ];
    // 1日目(水曜): 係長が休み、主任も休み
    staffList[0].days[0] = '休';
    staffList[1].days[0] = '休';

    const dates = [{ m: 4, day: 1, wIdx: 2 }];
    const val = solver.validateInitialState(staffList, { dates, numDays: 28 });
    const hasChiefError = val.errors.some(e => e.includes('主任の出勤可能者が0名'));
    const conflictCell = val.conflictCells.find(c => c.staffIndex === 0 && c.dayIndex === 0);
    console.log('  -> Chief absent error detected:', hasChiefError);
    console.log('  -> Conflict cell for SectionChief off exists:', !!conflictCell);
    console.log('  -> Conflict reason hover message:', conflictCell?.reason);
    if (!hasChiefError || !conflictCell) throw new Error('SectionChief / Chief absent conflict check failed!');
}

// 4. Check Real Work Count (Plan B specification)
console.log('\n4. Checking Real Work calculation (Plan B: minus only when offset > 0)...');
{
    const staffList = [];
    for (let i = 0; i < 20; i++) {
        staffList.push({
            name: `スタッフ ${i+1}`,
            isHalf: (i === 0), // 1名半日勤務(0.5)
            isUnused: false,
            days: ['○']
        });
    }
    const grid = staffList.map(s => [{ symbol: '○', isFixed: false }]);

    // offset = 0 -> real = 19.5
    const s0 = new solver.ShiftScheduler(staffList, { dayOffsets: [0], numDays: 1 });
    const stat0 = s0.calculateStats(grid);
    console.log(`  -> Offset = 0, isHalf=1: totalWork=${stat0.daily[0].totalWork}, realWork=${stat0.daily[0].realWork} (Expected: 19.5)`);
    if (stat0.daily[0].realWork !== 19.5) throw new Error('Real work count failed at offset 0');

    // offset = +1 -> real = 18.5 (減算)
    const sPlus = new solver.ShiftScheduler(staffList, { dayOffsets: [1], numDays: 1 });
    const statPlus = sPlus.calculateStats(grid);
    console.log(`  -> Offset = +1: realWork=${statPlus.daily[0].realWork} (Expected: 18.5)`);
    if (statPlus.daily[0].realWork !== 18.5) throw new Error('Real work count failed at offset +1');

    // offset = -1 -> real = 19.5 (変更なし！)
    const sMinus = new solver.ShiftScheduler(staffList, { dayOffsets: [-1], numDays: 1 });
    const statMinus = sMinus.calculateStats(grid);
    console.log(`  -> Offset = -1: realWork=${statMinus.daily[0].realWork} (Expected: 19.5, NO change!)`);
    if (statMinus.daily[0].realWork !== 19.5) throw new Error('Real work count failed at offset -1');
}

// 5. Check index.html controls
console.log('\n5. Checking index.html UI controls...');
const indexHtml = fs.readFileSync('index.html', 'utf8');
const hasTermSelect = indexHtml.includes('id="termSelect"');
const paletteExcludeCount = (indexHtml.match(/data-sym="ー"/g) || []).length;
console.log('  -> Has termSelect:', hasTermSelect);
console.log('  -> Number of 「ー」 buttons in palettes:', paletteExcludeCount);
if (!hasTermSelect) throw new Error('termSelect missing in index.html');
if (paletteExcludeCount < 3) throw new Error('「ー」 button missing in some palettes');

// 6. Check Department HTML files
console.log('\n6. Checking Department HTML files...');
const depts = [
    { file: '1階病棟.html', deptId: '1f', pw: '11111' },
    { file: '2階病棟.html', deptId: '2f', pw: '22222' },
    { file: '3階病棟.html', deptId: '3f', pw: '33333' },
    { file: '南病棟.html', deptId: 'south', pw: '44444' },
    { file: 'ST.html', deptId: 'st', pw: '55555' },
    { file: '生活期_管理者.html', deptId: 'life_admin', pw: '66666' },
    { file: 'マスター統括.html', deptId: 'master', pw: '77777' }
];

depts.forEach(d => {
    const content = fs.readFileSync(d.file, 'utf8');
    const hasConfig = content.includes(`deptId: '${d.deptId}'`) && content.includes(`password: '${d.pw}'`);
    const hasTerm = content.includes('id="termSelect"');
    const hasExclude = content.includes('data-sym="ー"');
    console.log(`  -> ${d.file}: Exists, Config OK: ${hasConfig}, termSelect OK: ${hasTerm}, 「ー」 OK: ${hasExclude}`);
    if (!hasConfig || !hasTerm || !hasExclude) throw new Error(`Validation failed for ${d.file}`);
});

console.log('\nALL 6 SYSTEM VERIFICATION CATEGORIES PASSED 100% PERFECTLY!');
