const fs = require('fs');
const vm = require('vm');

const solverCode = fs.readFileSync('solver.js', 'utf8');
const win = {};
const sandbox = {
    console,
    window: win,
    Math,
    Array,
    Date,
    String,
    Number,
    Boolean,
    RegExp,
    Set,
    Map
};
vm.createContext(sandbox);
vm.runInContext(solverCode, sandbox);

const ShiftScheduler = win.ShiftScheduler;

// 南病棟スタッフでテスト（南2: 1〜22, 南3: 23〜44）
const staffListSouth = [];
for (let i = 1; i <= 44; i++) {
    staffListSouth.push({
        id: i,
        name: `スタッフ ${String(i).padStart(2, '0')}`,
        floor: (i <= 22) ? '南2' : '南3',
        subFloor: (i <= 22) ? '南2' : '南3',
        section: (i <= 22) ? '南2' : '南3',
        isSectionChief: (i === 1),
        isChief: (i === 2),
        isSubChief: (i === 3 || i === 4),
        can8: (i >= 5 && i <= 14), // ★ ここがポイント！1〜9番（南2）しか can8 が付いていないのでは！？
        canSched: (i >= 5 && i <= 10),
        days: new Array(28).fill(''),
        prevDays: ['', '', '', '', '']
    });
}

const dates = [];
for (let d = 0; d < 28; d++) {
    const dt = new Date(2026, 3, 1 + d);
    dates.push({
        dIndex: d,
        label: `${dt.getMonth() + 1}/${dt.getDate()}`,
        wIdx: (dt.getDay() + 6) % 7,
        isHoliday: false
    });
}

const solverSouth = new ShiftScheduler(staffListSouth, {
    dates: dates,
    isSouth: true,
    standardHolidays: 8,
    isFinal: false
});

solverSouth.solve({ force: true });
solverSouth.assignSpecialDutiesToGrid({ force: true });

// Check 8h distribution by South2 vs South3
let countS2 = 0, countS3 = 0;
for (let s = 0; s < 44; s++) {
    const st = staffListSouth[s];
    const isS2 = (st.floor === '南2' || st.subFloor === '南2');
    for (let d = 0; d < 28; d++) {
        if (solverSouth.grid[s][d].symbol === '8時') {
            if (isS2) countS2++;
            else countS3++;
        }
    }
}
console.log('Current South 8h distribution: 南2 (Team A) =', countS2, ', 南3 (Team B) =', countS3);

// 各スタッフの特殊勤務回数内訳
console.log('Staff 8h & Special Duty Breakdown:');
for (let s = 0; s < 25; s++) {
    let h8 = 0, early = 0, late = 0, eve = 0;
    for (let d = 0; d < 28; d++) {
        const sym = solverSouth.grid[s][d].symbol;
        if (sym === '8時') h8++;
        else if (sym === '早') early++;
        else if (sym === '遅') late++;
        else if (sym === 'E') eve++;
    }
    if (h8 > 0 || early > 0 || late > 0 || eve > 0) {
        console.log(`Staff ${s+1} (${staffListSouth[s].floor}): 8h=${h8}, 早=${early}, 遅=${late}, E=${eve}, Total=${h8+early+late+eve}`);
    }
}
