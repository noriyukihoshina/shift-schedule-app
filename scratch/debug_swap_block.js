const { ShiftScheduler, SYMBOLS, isWorkSymbol, isHolidaySymbol, isPurePublicOffSymbol } = require('../solver.js');

const dates = [];
for (let m = 6; m <= 7; m++) {
    const startD = (m === 6 ? 24 : 1);
    const endD = (m === 6 ? 30 : 21);
    for (let d = startD; d <= endD; d++) {
        const dt = new Date(2026, m - 1, d);
        const wIdx = (dt.getDay() + 6) % 7;
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
scheduler.solveLife();

// 7/21(火) (real=8) から 7/16(木) (real=5) へのスワップを試行し、各スタッフがなぜダメか判定
const maxD = 27; // 7/21
const minD = 22; // 7/16
console.log(`maxD: ${dates[maxD].month}/${dates[maxD].day}, minD: ${dates[minD].month}/${dates[minD].day}`);

const patBStaff = [];
staffList.forEach((st, s) => {
    const sec = st.lifeSection || '';
    const ha = st.haSection || '';
    const isPatA = !!st.isSatSunOff || (!st.isSunOff && (sec === '訪問' || sec === '管理' || sec === 'Cl1' || ha === 'ハ1' || ha === 'ハ2'));
    const isPatB = !isPatA && (sec === '通所' || sec === 'Cl2' || ha === 'ハ3' || ha === 'ハ南' || ha === 'ハ4');
    if (isPatB) patBStaff.push(s);
});

patBStaff.forEach(s => {
    const symMax = scheduler.grid[s][maxD].symbol;
    const symMin = scheduler.grid[s][minD].symbol;
    if (symMax === SYMBOLS.WORK && symMin === SYMBOLS.OFF) {
        scheduler.setSymbol(s, maxD, SYMBOLS.OFF, false);
        scheduler.setSymbol(s, minD, SYMBOLS.WORK, false);
        const hardOk = scheduler.isStaffHardValid(s);
        let reason = '';
        if (!hardOk) {
            // なぜ hardOk でないか？
            // 連勤？ 週休？
            const row = scheduler.grid[s].map(c => c.symbol);
            let consec = 0;
            for (let d = 0; d < 28; d++) {
                if (isWorkSymbol(row[d])) {
                    consec++;
                    if (consec > 5) reason += `5連勤超過(day ${d}), `;
                } else consec = 0;
            }
            // 週休
            for (const span of scheduler.weekSpans) {
                let wCnt = 0;
                for (const wd of span) {
                    if (isWorkSymbol(row[wd])) wCnt++;
                }
                if (wCnt > 5) reason += `週出勤超過(${wCnt}日), `;
            }
        }
        console.log(`Staff ${staffList[s].name}: hardOk=${hardOk}, reason=${reason}`);
        // 戻す
        scheduler.setSymbol(s, maxD, SYMBOLS.WORK, false);
        scheduler.setSymbol(s, minD, SYMBOLS.OFF, false);
    } else {
        console.log(`Staff ${staffList[s].name}: cannot swap (maxSym=${symMax}, minSym=${symMin})`);
    }
});
