const fs = require('fs');

// Load solver
const solverCode = fs.readFileSync('solver.js', 'utf8');
eval(solverCode);

// Mock South ward staff (南2, 南3)
const staffList = [];
for (let i = 1; i <= 44; i++) {
    staffList.push({
        id: i,
        name: `スタッフ ${String(i).padStart(2, '0')}`,
        floor: (i <= 22) ? '南2' : '南3',
        subFloor: (i <= 22) ? '南2' : '南3',
        isSectionChief: (i === 1),
        isChief: (i === 2),
        isSubChief: (i === 3 || i === 4),
        can8: (i >= 5 && i <= 14), // 8時可能スタッフ
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

const solver = new ShiftScheduler(staffList, {
    dates: dates,
    isSouth: true,
    standardHolidays: 8,
    isFinal: false
});

const result = solver.solve({ force: true });
console.log('Solve success:', result.success);

// Check 8h duty per day
const dailyH8 = new Array(28).fill(0);
for (let s = 0; s < 44; s++) {
    for (let d = 0; d < 28; d++) {
        if (solver.grid[s][d].symbol === '8時') {
            dailyH8[d]++;
        }
    }
}
console.log('Daily 8h duty counts (should all be 1):', dailyH8);
const allOne = dailyH8.every(c => c === 1);
console.log('All days have exactly 1 8h duty:', allOne);

// Check staff 1 (section chief) holidays count
let scOff = 0;
for (let d = 0; d < 28; d++) {
    if (solver.grid[0][d].symbol === '休') scOff++;
}
console.log('Staff 1 (Section Chief) holidays count:', scOff);
