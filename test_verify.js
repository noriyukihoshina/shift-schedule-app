const fs = require('fs');
const { isJapaneseHoliday, NUM_DAYS = 28 } = require('./solver.js');

const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日'];

function getTermInfoSim(startStr = '2026-04-01') {
    const parts = startStr.split('-').map(Number);
    const startDate = new Date(parts[0], parts[1] - 1, parts[2]);

    const dates = [];
    for (let i = 0; i < 28; i++) {
        const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const day = d.getDate();
        const wIdx = (d.getDay() + 6) % 7; // 月曜=0, 日曜=6
        const isHoliday = isJapaneseHoliday(y, m, day);
        dates.push({
            y,
            m,
            year: y,
            month: m,
            day,
            weekday: WEEKDAYS[wIdx],
            label: `${m}/${day}`,
            wIdx,
            isSun: (wIdx === 6),
            isSat: (wIdx === 5),
            isHoliday,
            isHol: isHoliday,
            dateObj: d
        });
    }
    return { dates };
}

function createDefaultDayOffsets(dates) {
    const arr = new Array(28).fill(0);
    for (let d = 0; d < 28; d++) {
        const dObj = dates[d];
        if (dObj) {
            const isWeekendOrHol = dObj.isSun || dObj.isSat || 
                                   dObj.wIdx === 5 || dObj.wIdx === 6 || 
                                   dObj.weekday === '土' || dObj.weekday === '日' || 
                                   dObj.isHoliday || dObj.isHol;
            if (isWeekendOrHol) {
                arr[d] = -2;
            }
        }
    }
    return arr;
}

const term = getTermInfoSim('2026-04-01');
const offsets = createDefaultDayOffsets(term.dates);

console.log('--- Date by Date Offset Inspection (2026-04-01 to 2026-04-28) ---');
let satCount = 0, sunCount = 0, holCount = 0, weekdayCount = 0;
term.dates.forEach((d, idx) => {
    const off = offsets[idx];
    const isSat = d.wIdx === 5;
    const isSun = d.wIdx === 6;
    const isHol = d.isHoliday;
    if (isSat) satCount++;
    if (isSun) sunCount++;
    if (isHol) holCount++;
    if (!isSat && !isSun && !isHol) weekdayCount++;

    const expected = (isSat || isSun || isHol) ? -2 : 0;
    if (off !== expected) {
        console.error(`MISMATCH on ${d.label} (${d.weekday}): expected ${expected}, got ${off}`);
        process.exit(1);
    }
    console.log(`Day ${idx+1} [${d.label} ${d.weekday}]: offset = ${off > 0 ? '+'+off : off} ${isHol ? '(祝日)' : (isSat ? '(土)' : (isSun ? '(日)' : ''))}`);
});

console.log(`\nVerification Result:`);
console.log(`- Saturdays: ${satCount} days (all -2)`);
console.log(`- Sundays: ${sunCount} days (all -2)`);
console.log(`- Holidays: ${holCount} days (all -2)`);
console.log(`- Weekdays: ${weekdayCount} days (all 0)`);
console.log(`TOTAL: ${satCount + sunCount + holCount} days with -2 offset, ${weekdayCount} days with 0 offset.`);
console.log('SUCCESS: All weekends and holidays are correctly assigned -2!');
