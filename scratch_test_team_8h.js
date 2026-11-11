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

// 1階病棟スタッフでテスト（PT A, PT B, OT A, OT B）
const staffList1F = [];
for (let i = 1; i <= 44; i++) {
    const isA = (i % 2 === 1);
    staffList1F.push({
        id: i,
        name: `スタッフ ${String(i).padStart(2, '0')}`,
        floor: '1F',
        section: (i <= 22) ? (isA ? 'PT A' : 'PT B') : (isA ? 'OT A' : 'OT B'),
        isSectionChief: (i === 1),
        isChief: (i === 2),
        isSubChief: (i === 3 || i === 4),
        can8: (i >= 5 && i <= 14), // 10名が8時可能 (Aが5名, Bが5名)
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

const solver1F = new ShiftScheduler(staffList1F, {
    dates: dates,
    isSouth: false,
    standardHolidays: 8,
    isFinal: false
});

solver1F.solve({ force: true });
solver1F.assignSpecialDutiesToGrid({ force: true });

// Check 8h distribution by team
let countA = 0, countB = 0;
for (let s = 0; s < 44; s++) {
    const st = staffList1F[s];
    const isTeamA = st.section.includes('A');
    for (let d = 0; d < 28; d++) {
        if (solver1F.grid[s][d].symbol === '8時') {
            if (isTeamA) countA++;
            else countB++;
        }
    }
}
console.log('Current 1F 8h distribution: Team A =', countA, ', Team B =', countB);
