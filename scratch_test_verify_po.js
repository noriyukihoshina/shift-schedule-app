const fs = require('fs');
const { ShiftScheduler } = require('./solver.js');

// 2026年4月の28日間（水曜スタート）
const dates = [];
for (let d = 1; d <= 28; d++) {
    const dateObj = new Date(2026, 3, d);
    const wIdx = (dateObj.getDay() + 6) % 7; // 月0, 日6
    dates.push({
        day: d,
        wIdx: wIdx,
        isSunday: (wIdx === 6),
        isSaturday: (wIdx === 5)
    });
}

console.log("\n=== 2. PO病棟ソルバー検証 (8時AB均等・特殊勤務早2遅1E1) ===");
const poStaff = [];
for (let i = 1; i <= 48; i++) {
    const isSecChief = (i === 1 || i === 14 || i === 27 || i === 38);
    const sec = (i <= 13) ? 'PT A' : ((i <= 26) ? 'PT B' : ((i <= 37) ? 'OT A' : 'OT B'));
    const can8 = ((i >= 2 && i <= 6) || (i >= 15 && i <= 19) || (i >= 28 && i <= 32) || (i >= 39 && i <= 43));
    poStaff.push({
        id: i,
        name: `スタッフ ${String(i).padStart(2, '0')}`,
        isUnused: false,
        section: sec,
        isSectionChief: isSecChief,
        can8: can8,
        noEarly: false,
        noLate: false,
        noEve: false,
        prevDays: ['', '', '', '', ''],
        days: new Array(28).fill('')
    });
}

const poScheduler = new ShiftScheduler(poStaff, {
    standardHolidays: 8,
    dates: dates,
    isST: false,
    isSouth: false,
    isLife: false
});

poScheduler.solveBaseSchedule({ force: true });
const poRes = poScheduler.assignSpecialDutiesToGrid({ force: true });
console.log("PO solver success:", poRes.success);

// 検証D: 8時のチーム配分（Aチーム vs Bチーム）
let h8TeamA = 0;
let h8TeamB = 0;
for (let d = 0; d < 28; d++) {
    for (let s = 0; s < 48; s++) {
        if (poRes.grid[s][d].symbol === '8時') {
            const sec = poStaff[s].section;
            if (sec.includes('A')) h8TeamA++;
            if (sec.includes('B')) h8TeamB++;
        }
    }
}
console.log(`8h distribution: Team A = ${h8TeamA}, Team B = ${h8TeamB} (Total 28, Target 14 vs 14)`);

// 検証E: 特殊勤務の個人回数（8時なしスタッフの早・遅・E内訳）
let non8Sample = [];
for (let s = 0; s < 48; s++) {
    if (poStaff[s].isSectionChief) continue;
    let eCnt = 0, lCnt = 0, evCnt = 0, h8Cnt = 0;
    for (let d = 0; d < 28; d++) {
        const sym = poRes.grid[s][d].symbol;
        if (sym === '早') eCnt++;
        if (sym === '遅') lCnt++;
        if (sym === 'E') evCnt++;
        if (sym === '8時') h8Cnt++;
    }
    const tot = eCnt + lCnt + evCnt;
    if (h8Cnt === 0) {
        non8Sample.push({ id: s+1, early: eCnt, late: lCnt, eve: evCnt, total: tot });
    }
}
console.log("Sample of non-8h staff special duties breakdown (Target: Total 4 -> 早2, 遅1, E1):");
non8Sample.slice(0, 10).forEach(st => {
    console.log(`  Staff ${st.id}: 早=${st.early}, 遅=${st.late}, E=${st.eve} (Total=${st.total})`);
});
