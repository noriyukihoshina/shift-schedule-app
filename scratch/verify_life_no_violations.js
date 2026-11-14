const { ShiftScheduler, createTermDates, SYMBOLS, isWorkSymbol, isHolidaySymbol } = require('../solver.js');

function createDates(startStr) {
    const parts = startStr.split('-').map(Number);
    const startDate = new Date(parts[0], parts[1] - 1, parts[2]);
    const dates = [];
    for (let i = 0; i < 28; i++) {
        const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const day = d.getDate();
        const wIdx = (d.getDay() + 6) % 7;
        dates.push({
            date: d,
            year: y,
            month: m,
            day: day,
            dateStr: `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
            dow: ['月', '火', '水', '木', '金', '土', '日'][wIdx],
            wIdx: wIdx,
            isSun: (wIdx === 6),
            isSat: (wIdx === 5),
            isHoliday: false
        });
    }
    return dates;
}

const dates = createDates('2026-06-24');

// 生活期スタッフ（通所トレ、通所トレ2、訪問、通所、ハ3、ハ南、Cl1、管理など計35名）
const lifeStaff = [];
for (let s = 1; s <= 35; s++) {
    const st = {
        id: s,
        name: `生活期スタッフ ${s}`,
        isUnused: false,
        days: {},
        prevDays: ['○', '○', '休', '○', '休', '○', '○']
    };
    if (s === 29) { st.name = 'クラーク2'; st.lifeSection = 'Cl2'; st.isSunOff = true; }
    else if (s === 30) { st.name = '通所トレ'; st.lifeSection = 'Cl2'; st.isSunOff = true; st.days[16] = '上2'; }
    else if (s === 31) { st.name = '通所トレ2'; st.lifeSection = 'Cl2'; st.isSunOff = true; st.days[16] = '上2'; }
    else if (s <= 10) { st.lifeSection = '訪問'; st.can8 = (s <= 5); st.isSatSunOff = true; }
    else if (s <= 20) { st.lifeSection = '通所'; st.isSunOff = true; }
    else if (s <= 25) { st.haSection = 'ハ3'; st.isSunOff = true; }
    else if (s <= 28) { st.haSection = 'ハ南'; st.isSunOff = true; }
    else { st.lifeSection = '管理'; st.isSatSunOff = true; }

    lifeStaff.push(st);
}

console.log('=== 生活期（solveLife）シミュレーション検証 ===');
const scheduler = new ShiftScheduler(lifeStaff, {
    standardHolidays: 8.0,
    dates: dates,
    isLife: true
});

const res = scheduler.solveLife();
console.log('solveLife success:', res.success);

let violations = [];
for (let s = 0; s < lifeStaff.length; s++) {
    const st = lifeStaff[s];
    // 1. 公休日数チェック
    let offCount = 0;
    for (let d = 0; d < 28; d++) {
        const sym = scheduler.grid[s][d].symbol;
        if (sym === SYMBOLS.OFF) offCount += 1.0;
        else if (sym === '半休' || sym === '前休' || sym === '後休') offCount += 0.5;
    }
    if (Math.abs(offCount - 8.0) > 0.01) {
        violations.push(`【スタッフ No.${st.id} ${st.name}】公休日数が8日ではありません: ${offCount}日`);
    }

    // 2. 連勤チェック（最大5連勤）
    const seq = [...st.prevDays];
    for (let d = 0; d < 28; d++) seq.push(scheduler.grid[s][d].symbol);

    let streak = 0;
    for (let i = 0; i < seq.length; i++) {
        if (isWorkSymbol(seq[i])) {
            streak++;
            if (streak > 5) {
                violations.push(`【スタッフ No.${st.id} ${st.name}】5連勤超過（${streak}連勤）が発生しました！`);
                break;
            }
        } else {
            streak = 0;
        }
    }

    // 3. 週休2日チェック
    for (const wSpan of scheduler.weekSpans) {
        let wWork = 0;
        for (const d of wSpan) {
            if (isWorkSymbol(scheduler.grid[s][d].symbol)) wWork++;
        }
        if (wWork > 5) {
            violations.push(`【スタッフ No.${st.id} ${st.name}】週出勤超過（出勤${wWork}日）が発生しました！`);
            break;
        }
    }
}

// 4. Cl2同日休みチェック
let cl2Simultaneous = 0;
for (let d = 0; d < 28; d++) {
    const di = dates[d];
    if (di.wIdx === 6) continue;
    const cl2Indices = [28, 29, 30]; // 29, 30, 31
    if (cl2Indices.every(s => isHolidaySymbol(scheduler.grid[s][d].symbol))) {
        cl2Simultaneous++;
    }
}
if (cl2Simultaneous > 0) {
    violations.push(`Cl2スタッフの月〜土同日休みが ${cl2Simultaneous} 日発生しています！`);
}

if (violations.length === 0) {
    console.log('✅ PASS: 生活期35名全員において「公休8.0日厳格一致」「5連勤以内」「完全週休2日」「Cl2同日休み0件」が100%遵守されています！違反0件！');
} else {
    console.error('❌ FAIL: 以下の違反が検出されました:');
    violations.forEach(v => console.error(v));
}
