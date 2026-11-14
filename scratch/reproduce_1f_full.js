const fs = require('fs');
const html = fs.readFileSync('dump_1f.html', 'utf8');

const { ShiftScheduler, autoAssignRefreshHolidaysCore, REFRESH_HOLIDAY_CONFIG, SYMBOLS, isWorkSymbol, isHolidaySymbol } = require('../solver.js');

// inputTableBody から各スタッフの情報を抽出
const inputBodyMatch = html.match(/<tbody id="inputTableBody">([\s\S]*?)<\/tbody>/);
const rows = inputBodyMatch[1].split(/<tr\b[^>]*>/).filter(r => r.includes('</td>'));

const staffList = [];
for (let s = 0; s < rows.length; s++) {
    const row = rows[s];
    const nameMatch = row.match(/class="staff-name-input"\s+value="([^"]*)"/);
    const name = nameMatch ? nameMatch[1] : `スタッフ ${s + 1}`;
    
    const isUnused = /class="[^"]*staff-unused-checkbox[^"]*"[^>]*checked/.test(row);
    const isChief = /class="[^"]*staff-chief-checkbox[^"]*"[^>]*checked/.test(row);
    const isSectionChief = /class="[^"]*staff-section-chief-checkbox[^"]*"[^>]*checked/.test(row);
    const can8 = /class="[^"]*staff-can8-checkbox[^"]*"[^>]*checked/.test(row);
    const canSched = /class="[^"]*staff-cansched-checkbox[^"]*"[^>]*checked/.test(row);
    const isFullTime = !(/class="[^"]*staff-parttime-checkbox[^"]*"[^>]*checked/.test(row));
    const isHalf = /class="[^"]*staff-half-checkbox[^"]*"[^>]*checked/.test(row);

    const cellRegex = /<td\b[^>]*data-d="(\d+)"[^>]*>([\s\S]*?)<\/td>/g;
    const days = new Array(28).fill('');
    let cm;
    while ((cm = cellRegex.exec(row)) !== null) {
        const d = parseInt(cm[1]);
        const content = cm[2].trim().replace(/<[^>]+>/g, '').trim();
        days[d] = content;
    }

    staffList.push({
        id: s + 1,
        name,
        isUnused,
        isChief,
        isSectionChief,
        can8,
        canSched,
        isFullTime,
        isHalf,
        days,
        prevDays: []
    });
}

// ターム日付情報を作成（2026-06-24〜2026-07-21）
const dates = [];
const startDate = new Date('2026-06-24T00:00:00');
for (let d = 0; d < 28; d++) {
    const dt = new Date(startDate);
    dt.setDate(dt.getDate() + d);
    const wIdx = dt.getDay(); // 0: Sun, ..., 6: Sat
    dates.push({
        dateStr: dt.toISOString().split('T')[0],
        wIdx,
        isSun: wIdx === 0,
        isSat: wIdx === 6,
        isHoliday: false
    });
}

// 1. リフレッシュ休暇の自動割り振りを実行
const refRes = autoAssignRefreshHolidaysCore({
    staffList: staffList,
    dates: dates,
    termStartDate: '2026-06-24'
});
console.log('Refresh holiday assign:', refRes ? 'success' : 'failed');

// 2. 基本勤務表ソルバー（solveBaseSchedule）を実行
const scheduler = new ShiftScheduler(staffList, {
    standardHolidays: 8.0,
    dates: dates,
    dayOffsets: new Array(28).fill(0),
    isST: false,
    isSouth: false,
    isLife: false
});

console.time('solveBaseSchedule');
const res = scheduler.solveBaseSchedule();
console.timeEnd('solveBaseSchedule');

console.log('Solve success:', res.success);
if (!res.success) {
    console.log('Errors:', res.errors);
}

// 集計
let offStats = {};
res.grid.forEach((row, s) => {
    if (staffList[s].isUnused) return;
    let off = 0;
    let singleWork = 0;
    let maxConsec = 0;
    let curConsec = 0;
    for (let d = 0; d < 28; d++) {
        const sym = row[d].symbol;
        if (sym === '休') off++;
        if (isWorkSymbol(sym)) {
            curConsec++;
            if (curConsec > maxConsec) maxConsec = curConsec;
            const prev = (d > 0) ? row[d - 1].symbol : '';
            const next = (d < 27) ? row[d + 1].symbol : '';
            if (isHolidaySymbol(prev) && isHolidaySymbol(next)) {
                singleWork++;
            }
        } else {
            curConsec = 0;
        }
    }
    offStats[off] = (offStats[off] || 0) + 1;
    if (off !== 8) {
        console.log(`ALERT: Staff ${staffList[s].name} off = ${off}, maxConsec = ${maxConsec}, single = ${singleWork}`);
        console.log('Row:', row.map(c => c.symbol).join(','));
    }
});
console.log('Off stats:', offStats);
