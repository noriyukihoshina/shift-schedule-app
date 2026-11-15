const { ShiftScheduler, getTermRefreshGroups } = require('../solver.js');

function generateTestStaffList(floorType) {
    const staffList = [];
    for (let i = 1; i <= 60; i++) {
        const isUnused = (i > 48);
        staffList.push({
            id: i,
            name: `スタッフ ${String(i).padStart(2, '0')}`,
            isUnused: isUnused,
            floor: floorType,
            section: (i <= 12 ? 'PT A' : (i <= 24 ? 'OT A' : (i <= 36 ? 'PT B' : 'OT B'))),
            can8: ((i >= 2 && i <= 6) || (i >= 15 && i <= 19) || (i >= 28 && i <= 32) || (i >= 39 && i <= 43)),
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

function getDates(startDateStr) {
    const dates = [];
    const [y, m, d] = startDateStr.split('-').map(Number);
    const start = new Date(y, m - 1, d);
    for (let i = 0; i < 28; i++) {
        const cur = new Date(start);
        cur.setDate(start.getDate() + i);
        dates.push({
            year: cur.getFullYear(),
            month: cur.getMonth() + 1,
            day: cur.getDate(),
            wIdx: cur.getDay(),
            isSun: (cur.getDay() === 0),
            isSat: (cur.getDay() === 6)
        });
    }
    return dates;
}

const staff3 = generateTestStaffList('1f');
const dates3 = getDates('2026-05-27');
const sched3 = new ShiftScheduler(staff3, { standardHolidays: 8.0, dates: dates3, dayOffsets: new Array(28).fill(0) });
sched3.solveBaseSchedule({});

const pastHistory = {};
for (let s = 0; s < 48; s++) {
    const refs = [];
    for (let d = 0; d < 28; d++) {
        const sym = sched3.grid[s][d].symbol;
        if (sym.startsWith('上') || sym.startsWith('下')) refs.push(sym);
    }
    if (refs.length > 0) pastHistory[staff3[s].id] = refs;
}

const staff4 = generateTestStaffList('1f');
const dates4 = getDates('2026-06-24');
const sched4 = new ShiftScheduler(staff4, { standardHolidays: 8.0, dates: dates4, dayOffsets: new Array(28).fill(0) });
sched4.solveBaseSchedule({ skipAutoRefresh: true });

// 上1グループについて、candidates と toAssign を調査
const groups = getTermRefreshGroups(dates4);
const u1Grp = groups[0];
console.log('u1Grp symbol:', u1Grp.symbol);

let alreadyObtainedInPast = 0;
for (let s = 0; s < 48; s++) {
    const st = staff4[s];
    const history = pastHistory[st.id] || pastHistory[s];
    const hasObtained = (history instanceof Set) ? history.has(u1Grp.symbol) : (Array.isArray(history) && history.includes(u1Grp.symbol));
    if (hasObtained) alreadyObtainedInPast++;
}
const remainingUnobtained = Math.max(0, 48 - alreadyObtainedInPast);
console.log('alreadyObtainedInPast:', alreadyObtainedInPast, 'remainingUnobtained:', remainingUnobtained);

const candidates = [];
for (let s = 0; s < 48; s++) {
    const st = staff4[s];
    const history = pastHistory[st.id] || pastHistory[s];
    const hasObtained = (history instanceof Set) ? history.has(u1Grp.symbol) : (Array.isArray(history) && history.includes(u1Grp.symbol));
    if (hasObtained) continue;

    candidates.push({ sIdx: s, staff: st });
}
console.log('candidates length:', candidates.length);
console.log('candidates IDs:', candidates.map(c => c.staff.id).join(', '));

const targetCount = remainingUnobtained;
const toAssign = candidates.slice(0, targetCount);
console.log('toAssign length:', toAssign.length);
console.log('toAssign IDs:', toAssign.map(c => c.staff.id).join(', '));

// 各 candidate がベストデイを見つけられたか？
for (const cand of toAssign) {
    const sIdx = cand.sIdx;
    const st = cand.staff;
    let bestDay = -1;
    let bestScore = -999999;
    const dayTrials = [];

    for (const d of u1Grp.dayIndices) {
        const cell = sched4.grid[sIdx][d];
        if (cell.symbol !== '○' || cell.isFixed) {
            dayTrials.push({ d, reason: 'not_work: ' + cell.symbol });
            continue;
        }

        // 保護チェック
        let score = 100;
        dayTrials.push({ d, score });
        if (score > bestScore) {
            bestScore = score;
            bestDay = d;
        }
    }
    console.log(`Staff ${cand.staff.id}: bestDay=${bestDay}`, dayTrials);
}
