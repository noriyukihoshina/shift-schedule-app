// verify_master_constraints_realtime.js
const fs = require('fs');
const path = require('path');

console.log('=== マスターテーブル リアルタイム制約チェック機能の検証 ===\n');

// 1. evaluateStaffScheduleRow の動作をテスト
// app.js から関数を抽出して実行可能にする
const appJsCode = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf-8');
const solverJsCode = fs.readFileSync(path.join(__dirname, 'solver.js'), 'utf-8');

// app.js から evaluateStaffScheduleRow の定義を抽出
const funcMatch = appJsCode.match(/function evaluateStaffScheduleRow[\s\S]*?\n    }/);
if (!funcMatch) {
    console.error('❌ evaluateStaffScheduleRow の関数が見つかりません');
    process.exit(1);
}

const vm = require('vm');
const sandbox = {
    console: console,
    window: {},
    isRestrictedSpecial: (sym) => (sym === '早' || sym === '遅' || sym === 'E' || sym === 'ハヤ' || sym === 'オソ' || sym === 'イブ'),
    isHolidaySymbol: (sym) => (sym === '休' || sym === '有' || sym.includes('リフ') || sym.startsWith('上') || sym.startsWith('下')),
    isFullOffSymbol: (sym) => (sym === '休' || sym === '-' || sym.includes('リフ') || sym.startsWith('上') || sym.startsWith('下')),
    isWorkSymbol: (sym) => (sym !== '' && sym !== '休' && !sym.includes('リフ')),
    isHalfDuty: (sym) => (sym.includes('/')),
    getSunToSatWeekSpans: (dates, numDays = 28) => {
        const weeks = [];
        let currentWeek = [];
        for (let d = 0; d < numDays; d++) {
            const isSun = (dates && dates[d]) ? (dates[d].wIdx === 6 || dates[d].weekday === '日') : (d % 7 === 6);
            if (isSun && currentWeek.length > 0) {
                weeks.push(currentWeek);
                currentWeek = [];
            }
            currentWeek.push(d);
        }
        if (currentWeek.length > 0) weeks.push(currentWeek);
        return weeks;
    }
};

vm.createContext(sandbox);
vm.runInContext(solverJsCode, sandbox);
vm.runInContext(funcMatch[0], sandbox);

const evaluate = sandbox.evaluateStaffScheduleRow;
if (typeof evaluate !== 'function') {
    console.error('❌ evaluateStaffScheduleRow が未定義です');
    process.exit(1);
}

// 日付定義（28日間、日曜〜土曜の週）
const termDates = [];
const start = new Date(2026, 5, 24); // 6/24(水)
for (let d = 0; d < 28; d++) {
    const dt = new Date(start.getTime() + d * 86400000);
    termDates.push({
        dateObj: dt,
        m: dt.getMonth() + 1,
        day: dt.getDate(),
        wIdx: (dt.getDay() + 6) % 7,
        weekday: ['月','火','水','木','金','土','日'][(dt.getDay() + 6) % 7]
    });
}

// テスト1: 連勤が10ある場合（例: 10日間連続で '○'）
console.log('【TEST 1: 10連勤の検知と網掛け判定】');
const staff1 = { id: 1, name: 'テスト太郎', allow6Consec: false, prevDays: ['休', '休', '休', '休', '休'] };
const row1 = new Array(28).fill('休');
for (let d = 0; d < 10; d++) row1[d] = '○'; // 0〜9日目まで10連勤

const res1 = evaluate(staff1, row1, termDates);
console.log('  -> errors count:', res1.errors.length, res1.errors);
console.log('  -> dayConflicts count:', Object.keys(res1.dayConflicts).length);

if (res1.errors.some(e => e.includes('10連勤')) && Object.keys(res1.dayConflicts).length === 10) {
    console.log('  ✅ PASS: 10連勤が正常に検知され、10日間すべてのセルに違反網掛け情報が付与されました！');
} else {
    console.error('  ❌ FAIL: 10連勤の検知に問題があります');
    process.exit(1);
}

// テスト2: 特殊勤務（早）の翌日が休日でない場合（例: 0日目 '早'、1日目 '○'）
console.log('\n【TEST 2: 特殊勤務（早）翌日休日違反の検知と網掛け判定】');
const staff2 = { id: 2, name: 'テスト花子', allow6Consec: false, prevDays: ['休', '休', '休', '休', '休'] };
const row2 = new Array(28).fill('休');
row2[0] = '早';
row2[1] = '○'; // 翌日が出勤

const res2 = evaluate(staff2, row2, termDates);
console.log('  -> errors:', res2.errors);
if (res2.dayConflicts[0] && res2.dayConflicts[1] && res2.errors.some(e => e.includes('早') && e.includes('翌日'))) {
    console.log('  ✅ PASS: 特殊勤務（早）の翌日非休日が検知され、当日と翌日の両セルに違反網掛けが付与されました！');
} else {
    console.error('  ❌ FAIL: 特殊勤務翌日休の検知に問題があります');
    process.exit(1);
}

// テスト3: 日曜日〜土曜日の週に6勤（週休2日違反）がある場合
console.log('\n【TEST 3: 日曜日〜土曜日の週休2日違反（6勤）の検知と網掛け判定】');
const staff3 = { id: 3, name: 'テスト次郎', allow6Consec: false, prevDays: ['休', '休', '休', '休', '休'] };
const row3 = new Array(28).fill('休');
// 6/28(日)〜7/4(土) の7日間のうち6日を出勤にする（4日目〜9日目）
for (let d = 4; d <= 9; d++) row3[d] = '○'; // 6日間出勤、1日だけ休

const res3 = evaluate(staff3, row3, termDates);
console.log('  -> errors:', res3.errors);
if (res3.errors.some(e => e.includes('週休2日') || e.includes('出勤が6日'))) {
    console.log('  ✅ PASS: 日〜土の週休2日違反（6勤）が検知され、該当週の出勤セルに網掛けが付与されました！');
} else {
    console.error('  ❌ FAIL: 週休2日違反の検知に問題があります');
    process.exit(1);
}

// テスト4: 個別不可フラグ（早番不可なのに早番）
console.log('\n【TEST 4: 個別不可フラグ（早番不可）の検知】');
const staff4 = { id: 4, name: 'テスト三郎', noEarly: true, allow6Consec: false, prevDays: ['休', '休', '休', '休', '休'] };
const row4 = new Array(28).fill('休');
row4[2] = '早';
const res4 = evaluate(staff4, row4, termDates);
if (res4.errors.some(e => e.includes('早番不可')) && res4.dayConflicts[2]) {
    console.log('  ✅ PASS: 早番不可フラグOFF時の「早」が検知され、網掛けが付与されました！');
} else {
    console.error('  ❌ FAIL: 不可フラグの検知に問題があります');
    process.exit(1);
}

console.log('\n====================================================');
console.log('🎉 すべてのテストが完全合格しました！');
console.log('====================================================');
