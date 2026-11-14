const fs = require('fs');
const html = fs.readFileSync('dump_1f.html', 'utf8');

// solver.js を読み込む
const { ShiftScheduler, isWorkSymbol, isHolidaySymbol } = require('../solver.js');

// inputTableBody から各スタッフの情報を抽出
const inputBodyMatch = html.match(/<tbody id="inputTableBody">([\s\S]*?)<\/tbody>/);
const rows = inputBodyMatch[1].split(/<tr\b[^>]*>/).filter(r => r.includes('</td>'));

console.log('Row count:', rows.length);

const staffList = [];
for (let s = 0; s < rows.length; s++) {
    const row = rows[s];
    // スタッフ名
    const nameMatch = row.match(/class="staff-name-input"\s+value="([^"]*)"/);
    const name = nameMatch ? nameMatch[1] : `スタッフ ${s + 1}`;
    
    // チェックボックス
    const isUnused = /class="[^"]*staff-unused-checkbox[^"]*"[^>]*checked/.test(row);
    const isChief = /class="[^"]*staff-chief-checkbox[^"]*"[^>]*checked/.test(row);
    const isSectionChief = /class="[^"]*staff-section-chief-checkbox[^"]*"[^>]*checked/.test(row);
    const can8 = /class="[^"]*staff-can8-checkbox[^"]*"[^>]*checked/.test(row);
    const canSched = /class="[^"]*staff-cansched-checkbox[^"]*"[^>]*checked/.test(row);
    const isFullTime = !(/class="[^"]*staff-parttime-checkbox[^"]*"[^>]*checked/.test(row));
    const isHalf = /class="[^"]*staff-half-checkbox[^"]*"[^>]*checked/.test(row);

    // days
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

console.log('Parsed staff count:', staffList.length);
const activeStaff = staffList.filter(st => !st.isUnused);
console.log('Active staff count:', activeStaff.length);

// ソルバーを実行
const scheduler = new ShiftScheduler(staffList, {
    termStartDate: '2026-06-24',
    numDays: 28,
    targetHolidayCount: 8,
    reqDayOff: 8,
    isFirstFloor: true
});

console.time('solve');
const res = scheduler.solve();
console.timeEnd('solve');

console.log('Solve success:', res.success);
if (!res.success) {
    console.log('Error msg:', res.message);
}

// 各スタッフの公休数を集計
let offCountStats = {};
let singleWorkCount = 0;
let overConsecCount = 0;

res.grid.forEach((row, s) => {
    if (staffList[s].isUnused) return;
    let off = 0;
    let curConsec = 0;
    let maxConsec = 0;
    for (let d = 0; d < 28; d++) {
        const sym = row[d].symbol;
        if (sym === '休') off++;
        if (isWorkSymbol(sym)) {
            curConsec++;
            if (curConsec > maxConsec) maxConsec = curConsec;
            // 1勤判定
            const prev = (d > 0) ? row[d - 1].symbol : '';
            const next = (d < 27) ? row[d + 1].symbol : '';
            if (isHolidaySymbol(prev) && isHolidaySymbol(next)) {
                singleWorkCount++;
                console.log(`Single work: Staff ${staffList[s].name} at d=${d} (${sym})`);
            }
        } else {
            curConsec = 0;
        }
    }
    if (maxConsec > 6) overConsecCount++;
    offCountStats[off] = (offCountStats[off] || 0) + 1;
    if (off !== 8) {
        console.log(`ALERT: Staff ${staffList[s].name} has offDays = ${off}! maxConsec = ${maxConsec}`);
        console.log('Symbols:', row.map(c => c.symbol).join(','));
    }
});

console.log('Off count distribution:', offCountStats);
console.log('Total single work (inner):', singleWorkCount);
console.log('Staff with consec > 6:', overConsecCount);
