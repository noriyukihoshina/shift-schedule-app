const { ShiftScheduler, SYMBOLS } = require('../solver.js');

// 添付1の日付（6/24〜7/21 第4ターム）
const dates = [];
for (let m = 6; m <= 7; m++) {
    const startD = (m === 6 ? 24 : 1);
    const endD = (m === 6 ? 30 : 21);
    for (let d = startD; d <= endD; d++) {
        const dt = new Date(2026, m - 1, d);
        const wIdx = (dt.getDay() + 6) % 7; // 月曜=0, 日曜=6, 土曜=5
        dates.push({
            year: 2026,
            month: m,
            day: d,
            wIdx: wIdx,
            isSun: (wIdx === 6),
            isSat: (wIdx === 5),
            isHoliday: false
        });
    }
}

// 生活期スタッフ31名
const staffList = [];
for (let i = 1; i <= 31; i++) {
    let name = '';
    let sec = '';
    let ha = '';
    let can8 = false;
    let isSatSun = false;
    let isSun = false;

    if (i <= 19) {
        name = `訪問スタッフ ${i}`;
        sec = '訪問';
        isSatSun = true;
        can8 = (i <= 18);
    } else if (i <= 23) {
        name = `通所スタッフ ${i}`;
        sec = '通所';
        isSun = true;
    } else if (i === 24) { name = 'ハーフ1'; ha = 'ハ1'; isSatSun = true; }
    else if (i === 25) { name = 'ハーフ2'; ha = 'ハ2'; isSatSun = true; }
    else if (i === 26) { name = 'ハーフ3'; ha = 'ハ3'; isSun = true; }
    else if (i === 27) { name = 'ハーフ南'; ha = 'ハ南'; isSun = true; }
    else if (i === 28) { name = 'クラーク'; sec = 'Cl1'; isSatSun = true; }
    else if (i === 29) { name = 'クラーク2'; sec = 'Cl2'; isSun = true; }
    else if (i === 30) { name = '通所トレ'; sec = '通所'; isSun = true; }
    else if (i === 31) { name = '通所トレ2'; sec = '通所'; isSun = true; }

    staffList.push({
        id: i,
        name: name,
        lifeSection: sec,
        haSection: ha,
        can8: can8,
        isSatSunOff: isSatSun,
        isSunOff: isSun,
        isUnused: false,
        days: new Array(28).fill('')
    });
}

const scheduler = new ShiftScheduler(staffList, { dates: dates, isLife: true, standardHolidays: 8 });

// ステップ1〜2を手動実行して、初期状態のグリッドを確認
for (let s = 0; s < 31; s++) {
    const st = staffList[s];
    const sec = st.lifeSection || '';
    const ha = st.haSection || '';
    const isPatA = !!st.isSatSunOff || (!st.isSunOff && (sec === '訪問' || sec === '管理' || sec === 'Cl1' || ha === 'ハ1' || ha === 'ハ2'));
    const isPatB = !isPatA && (!!st.isSunOff || (sec === '通所' || sec === 'Cl2' || ha === 'ハ3' || ha === 'ハ南' || ha === 'ハ4'));

    for (let d = 0; d < 28; d++) {
        const di = dates[d];
        const isSun = di ? (di.wIdx === 6) : (d % 7 === 6);
        const isSat = di ? (di.wIdx === 5) : (d % 7 === 5);

        if (isPatA && (isSat || isSun)) {
            scheduler.grid[s][d] = { symbol: SYMBOLS.OFF, isFixed: true };
        } else if (isPatB && isSun) {
            scheduler.grid[s][d] = { symbol: SYMBOLS.OFF, isFixed: true };
        } else {
            scheduler.grid[s][d] = { symbol: '', isFixed: false };
        }
    }
}

for (let s = 0; s < 31; s++) {
    const maxConsec = staffList[s].allow6Consec ? 6 : 5;
    const solved = scheduler.solveStaffScheduleWeekly(s, 8, maxConsec);
    if (solved) {
        for (let d = 0; d < 28; d++) {
            scheduler.grid[s][d] = {
                symbol: solved[d],
                isFixed: false
            };
        }
    }
}

// 通所スタッフの初期公休配置を観察
const patBStaff = [];
staffList.forEach((st, s) => {
    const sec = st.lifeSection || '';
    const ha = st.haSection || '';
    const isPatA = !!st.isSatSunOff || (!st.isSunOff && (sec === '訪問' || sec === '管理' || sec === 'Cl1' || ha === 'ハ1' || ha === 'ハ2'));
    const isPatB = !isPatA && (!!st.isSunOff || (sec === '通所' || sec === 'Cl2' || ha === 'ハ3' || ha === 'ハ南' || ha === 'ハ4'));
    if (isPatB) patBStaff.push(s);
});

console.log('通所対象スタッフ数:', patBStaff.length);
patBStaff.forEach(s => {
    const offDays = [];
    for (let d = 0; d < 28; d++) {
        if (scheduler.grid[s][d].symbol === SYMBOLS.OFF) {
            const di = dates[d];
            const wName = ['月', '火', '水', '木', '金', '土', '日'][di.wIdx];
            offDays.push(`${di.month}/${di.day}(${wName})`);
        }
    }
    console.log(`${staffList[s].name}: 公休数=${offDays.length}, 日程=[${offDays.join(', ')}]`);
});
