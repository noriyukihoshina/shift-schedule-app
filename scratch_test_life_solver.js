const fs = require('fs');
const vm = require('vm');

const solverCode = fs.readFileSync('solver.js', 'utf8');
const win = {};
const sandbox = { console, window: win, Math, Array, Date, String, Number, Boolean, RegExp, Set, Map };
vm.createContext(sandbox);
vm.runInContext(solverCode, sandbox);
const ShiftScheduler = win.ShiftScheduler;

// 生活期スタッフ作成（生活期は31名前後）
const staffListLife = [];
for (let i = 1; i <= 31; i++) {
    let role = '一般';
    let lifeSection = '';
    let isSatSunOff = false;
    let isSunOff = false;

    if (i <= 3) { lifeSection = '訪問'; isSatSunOff = true; }
    else if (i <= 6) { lifeSection = '管理'; isSatSunOff = true; }
    else if (i === 28 || i === 29) { lifeSection = 'Cl病棟'; isSatSunOff = true; }
    else if (i === 30 || i === 31) { lifeSection = 'Cl通所'; isSunOff = true; }
    else if (i >= 24 && i <= 27) { lifeSection = 'ハーフ'; isSunOff = true; }
    else { lifeSection = '通所'; isSunOff = true; }

    staffListLife.push({
        id: i,
        name: `スタッフ ${String(i).padStart(2, '0')}`,
        floor: '生活期',
        subFloor: '生活期',
        section: '生活期',
        lifeSection: lifeSection,
        isSatSunOff: isSatSunOff,
        isSunOff: isSunOff,
        canSched: true,
        days: new Array(28).fill(''),
        prevDays: ['', '', '', '', '']
    });
}

// 4/1(水) 〜 4/28(火)
const dates = [];
for (let d = 0; d < 28; d++) {
    const dt = new Date(2026, 3, 1 + d); // 2026-04-01 is Wednesday
    // wIdx: 0:月, 1:火, 2:水, 3:木, 4:金, 5:土, 6:日
    const jsDay = dt.getDay(); // 0 is Sunday
    const wIdx = (jsDay + 6) % 7;
    dates.push({
        dIndex: d,
        label: `${dt.getMonth() + 1}/${dt.getDate()}`,
        wIdx: wIdx,
        isHoliday: (wIdx === 6)
    });
}

const scheduler = new ShiftScheduler(staffListLife, {
    dates: dates,
    isLife: true,
    standardHolidays: 8,
    isFinal: false
});

scheduler.solve({ force: true });

console.log('--- Checking Staff 30 (Cl通所) ---');
const s30 = staffListLife[29];
const s30Days = scheduler.grid[29].map(cell => cell.symbol);
console.log('Days:', s30Days.join(' '));

// 連勤チェック
let maxStreak = 0;
let currentStreak = 0;
let violations = [];
for (let d = 0; d < 28; d++) {
    const sym = s30Days[d];
    if (sym === '休' || sym === '有' || sym === 'リフ') {
        if (currentStreak > 5) {
            violations.push(`Streak of ${currentStreak} ended at day ${d}`);
        }
        currentStreak = 0;
    } else {
        currentStreak++;
        if (currentStreak > maxStreak) maxStreak = currentStreak;
    }
}
if (currentStreak > 5) {
    violations.push(`Streak of ${currentStreak} at end`);
}

console.log('Max streak:', maxStreak);
console.log('Violations:', violations);

// 週休チェック (日〜土)
console.log('Week spans off count:');
scheduler.weekSpans.forEach((wSpan, idx) => {
    let offCount = 0;
    wSpan.forEach(d => {
        const sym = s30Days[d];
        if (sym === '休' || sym === '有' || sym === 'リフ') offCount++;
    });
    console.log(`Week ${idx + 1}: ${offCount} off days`);
});

console.log('\n--- Checking all life staff streaks ---');
let totalStreakViolations = 0;
for (let s = 0; s < staffListLife.length; s++) {
    const sDays = scheduler.grid[s].map(cell => cell.symbol);
    let cur = 0;
    for (let d = 0; d < 28; d++) {
        const sym = sDays[d];
        if (sym === '休' || sym === '有' || sym === 'リフ') {
            if (cur > 5) {
                console.log(`Staff ${s+1} (${staffListLife[s].name}, ${staffListLife[s].lifeSection}): Streak of ${cur} ended at day ${d}`);
                totalStreakViolations++;
            }
            cur = 0;
        } else {
            cur++;
        }
    }
    if (cur > 5) {
        console.log(`Staff ${s+1} (${staffListLife[s].name}, ${staffListLife[s].lifeSection}): Streak of ${cur} at end`);
        totalStreakViolations++;
    }
}
console.log(`Total streak violations (> 5 days): ${totalStreakViolations}`);
