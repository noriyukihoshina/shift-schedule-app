const fs = require('fs');

// 1. HTMLにボタンが存在するか検証
const masterFiles = ['master.html', 'マスターテーブル.html', 'マスター統括.html'];
masterFiles.forEach(f => {
    const html = fs.readFileSync(f, 'utf-8');
    const hasStatsBtn = html.includes('id="masterBalanceWeekdaysBtnStats"');
    const hasCheckBtn = html.includes('id="masterBalanceWeekdaysBtn"');
    console.log(`[${f}] statsBtn: ${hasStatsBtn}, checkBtn: ${hasCheckBtn}`);
});

// 2. solver.js で8時勤務の偏りが解消されているか検証
const vm = require('vm');
const solverCode = fs.readFileSync('solver.js', 'utf-8');
const sandbox = { console, require, module: {}, exports: {}, window: {} };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(solverCode, sandbox);

// 南病棟のスタッフ構成（スタッフ23名、8時可8名）
const southStaff = [];
for (let i = 1; i <= 23; i++) {
    const section = (i <= 11) ? '南2' : '南3';
    // can8 は各チーム4名ずつ計8名
    const can8 = (i >= 3 && i <= 6) || (i >= 14 && i <= 17);
    southStaff.push({
        id: i,
        name: `スタッフ ${String(i).padStart(2, '0')}`,
        isUnused: false,
        floor: '南',
        section: section,
        can8: can8,
        noEarly: false,
        noLate: false,
        noEve: false,
        canSched: false,
        isSectionChief: false,
        isChief: false,
        isSubChief: false,
        isHalf: false,
        isZeroCount: false,
        isFirstYear: false,
        lifeSection: '',
        haSection: '',
        jobTitle: '',
        isFullTime: false,
        allow6Consec: false,
        isSatSunOff: false,
        isSunOff: false,
        prevName: '',
        remarks: '',
        prevDays: ['', '', '', '', ''],
        days: new Array(28).fill('')
    });
}

const scheduler = new sandbox.ShiftScheduler(southStaff, { isSouth: true, standardHolidays: 8, numDays: 28 });
const res = scheduler.solve({ assignSpecial: true });
console.log('South Solve Success:', res.success);

const h8Counts = [];
for (let s = 0; s < 23; s++) {
    let c = 0;
    for (let d = 0; d < 28; d++) {
        if (scheduler.grid[s][d].symbol === '8時') c++;
    }
    h8Counts.push(c);
}
console.log('8h counts per staff:', h8Counts.join(' '));
const maxH8 = Math.max(...h8Counts);
console.log('Max 8h for any single staff:', maxH8);
console.log('Has any staff >= 6 8h?:', maxH8 >= 6);
