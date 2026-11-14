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

// 添付画像（生活期・1階・2階）の実際のスタッフ構成をシミュレート
// リフ上1、上2、有休、希望休がランダムかつ多数配置された34名
const staffList = [];
for (let s = 1; s <= 34; s++) {
    const st = {
        id: s,
        name: `スタッフ ${s}`,
        isUnused: false,
        days: {},
        prevDays: ['○', '○', '休', '○', '休', '○', '○'] // 前ターム末実績
    };
    // 添付画像のように、スタッフ16, 21, 28, 29, 30 にリフ上1や上2を配置
    if ([3, 4, 7, 12, 16, 21, 22, 23, 24, 25, 28, 29, 30, 31].includes(s)) {
        st.days[16] = '上2'; // 7/10リフ
    }
    if ([1, 8, 13].includes(s)) {
        st.days[4] = '上1'; // 6/28リフ
    }
    // 希望休
    if (s % 3 === 0) st.days[2] = '休';
    if (s % 4 === 0) st.days[10] = '休';
    if (s % 5 === 0) st.days[20] = '休';

    staffList.push(st);
}

console.log('=== 自動生成（solveBaseSchedule）シミュレーション検証 ===');
const scheduler = new ShiftScheduler(staffList, {
    standardHolidays: 8.0,
    dates: dates
});

const res = scheduler.solveBaseSchedule();
console.log('solveBaseSchedule success:', res.success);
if (!res.success) {
    console.error('Errors:', res.errors);
}

let violations = [];
for (let s = 0; s < staffList.length; s++) {
    const st = staffList[s];
    // 1. 公休日数チェック
    let offCount = 0;
    for (let d = 0; d < 28; d++) {
        const sym = scheduler.grid[s][d].symbol;
        if (sym === SYMBOLS.OFF) offCount += 1.0;
        else if (sym === '半休' || sym === '前休' || sym === '後休') offCount += 0.5;
    }
    if (Math.abs(offCount - 8.0) > 0.01) {
        violations.push(`【スタッフ No.${st.id}】公休日数が8日ではありません: ${offCount}日`);
    }

    // 2. 連勤チェック（最大5連勤、前ターム含む）
    const seq = [...st.prevDays];
    for (let d = 0; d < 28; d++) seq.push(scheduler.grid[s][d].symbol);

    let streak = 0;
    for (let i = 0; i < seq.length; i++) {
        if (isWorkSymbol(seq[i])) {
            streak++;
            if (streak > 5) {
                violations.push(`【スタッフ No.${st.id}】5連勤超過（${streak}連勤）が発生しました！(位置: ${i})`);
                break;
            }
        } else {
            streak = 0;
        }
    }

    // 3. 週休2日チェック（各週スパンで出勤最大5日以内）
    for (const wSpan of scheduler.weekSpans) {
        let wWork = 0;
        for (const d of wSpan) {
            if (isWorkSymbol(scheduler.grid[s][d].symbol)) wWork++;
        }
        if (wWork > 5) {
            violations.push(`【スタッフ No.${st.id}】週出勤超過（出勤${wWork}日・週休不足）が発生しました！`);
            break;
        }
    }
}

if (violations.length === 0) {
    console.log('✅ PASS: 34名全員において「公休8.0日厳格一致」「5連勤以内」「完全週休2日」が100%遵守されています！違反0件！');
} else {
    console.error('❌ FAIL: 以下の違反が検出されました:');
    violations.forEach(v => console.error(v));
}
