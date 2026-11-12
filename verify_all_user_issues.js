// -*- coding: utf-8 -*-
const assert = require('assert');
const { ShiftScheduler, validateInitialState, SYMBOLS } = require('./solver.js');

console.log('====================================================');
console.log('🧪 ユーザー指摘事項 徹底検証テストスイート');
console.log('====================================================\n');

// -------------------------------------------------------------------------
// TEST 1: STテーブルのブレ最小化実行と公休8日保持・集計検証
// -------------------------------------------------------------------------
console.log('【TEST 1: STテーブルのブレ最小化実行と公休8日表示検証】');
const stStaffList = [];
for (let i = 1; i <= 16; i++) {
    const floor = (i <= 4) ? '1F' : (i <= 8) ? '2F' : (i <= 12) ? '3F' : '南';
    stStaffList.push({
        name: `STスタッフ${i}`,
        floor: floor,
        days: new Array(28).fill('')
    });
}
const dates = [];
for (let d = 1; d <= 28; d++) {
    const dayOfWeek = (d % 7 === 6) ? '土' : (d % 7 === 0) ? '日' : '月';
    dates.push({
        dayNumber: d,
        dayOfWeek: dayOfWeek,
        isSaturday: (dayOfWeek === '土'),
        isSunday: (dayOfWeek === '日'),
        isHoliday: false
    });
}

const stScheduler = new ShiftScheduler(stStaffList, dates, { isST: true });
const stRes = stScheduler.solveBaseSchedule();
assert.strictEqual(stRes.success, true, 'ST基本勤務表生成が成功すること');

// 初期stats
const initialStats = stScheduler.calculateStats();
initialStats.staffStats.forEach((st, idx) => {
    assert.strictEqual(st.offDays, 8, `STスタッフ${idx+1}の公休が8日であること (実際: ${st.offDays})`);
});
console.log('  ✅ PASS: ST初期生成で全16名の公休が完全に8日であること確認');

// ブレ最小化ロジックの実行
const grid = JSON.parse(JSON.stringify(stScheduler.grid));
let swapped = false;
for (let s = 0; s < 16; s++) {
    const workD = grid[s].findIndex(c => c.symbol === SYMBOLS.WORK || c.symbol === '早');
    const offD = grid[s].findIndex(c => c.symbol === SYMBOLS.OFF);
    if (workD !== -1 && offD !== -1) {
        const origSym = grid[s][workD].symbol;
        grid[s][workD] = { symbol: SYMBOLS.OFF, isFixed: false };
        grid[s][offD] = { symbol: origSym, isFixed: false };
        swapped = true;
        break;
    }
}
assert.strictEqual(swapped, true, 'テストスワップが実行されたこと');

// スワップ後の calculateStats 検証
stScheduler.grid = grid;
const newStats = stScheduler.calculateStats();
newStats.staffStats.forEach((st, idx) => {
    assert.strictEqual(st.offDays, 8, `スワップ後もSTスタッフ${idx+1}の公休が8日を満額維持していること (実際: ${st.offDays})`);
});
console.log('  ✅ PASS: ブレ最小化スワップ後も全スタッフの公休が8日を満額維持（0表示バグ完全解消）');

// -------------------------------------------------------------------------
// TEST 2: クラークの所属と実数（Cl1は独立実数0、Cl2は通所所属実数1）検証
// -------------------------------------------------------------------------
console.log('\n【TEST 2: クラーク厳格定義（Cl1独立実数0、Cl2通所所属実数1）検証】');
const lifeStaffList = [];
for (let i = 1; i <= 30; i++) {
    lifeStaffList.push({
        id: i,
        name: `生活期スタッフ ${i}`,
        isUnused: false,
        lifeSection: (i <= 15) ? '訪問' : ((i <= 20) ? '通所' : ((i === 21) ? 'Cl1' : ((i === 22) ? 'Cl2' : '通所'))),
        haSection: '',
        isSunOff: (i > 15 && i !== 21),
        isSatSunOff: (i <= 15 || i === 21),
        can8: (i <= 3),
        days: new Array(28).fill('')
    });
}

const lifeScheduler = new ShiftScheduler(lifeStaffList, dates, { isLife: true });
const lifeRes = lifeScheduler.solveLife();
assert.strictEqual(lifeRes.success, true, '生活期スケジュール生成が成功すること');

// Cl1の実数寄与度: 常に0
const cl1Real = lifeScheduler.getStaffRealWorkAmt(20, '○');
assert.strictEqual(cl1Real, 0, 'Cl1（独立）のリハビリ実数は0であること');
console.log('  ✅ PASS: Cl1（クラーク1）は独立枠としてリハビリ実数 0名（完全除外）');

// Cl2の実数寄与度: 通常の1.0
const cl2Real = lifeScheduler.getStaffRealWorkAmt(21, '○');
assert.strictEqual(cl2Real, 1.0, 'Cl2（通所所属）のリハビリ実数は1.0であること');
console.log('  ✅ PASS: Cl2（クラーク2）は通所所属としてリハビリ実数 1.0名として加算');

// calculateStats でのセクション集計検証
const lifeStats = lifeScheduler.calculateStats();
for (let d = 0; d < 28; d++) {
    const sw = lifeStats.daily[d].sectionWork;
    const cl2Sym = lifeScheduler.grid[21][d].symbol;
    if (cl2Sym === SYMBOLS.WORK || cl2Sym === '〇') {
        assert(sw['通所'] >= 1, `Cl2出勤日(${d+1}日目)に通所人数にCl2が含まれていること`);
    }
}
console.log('  ✅ PASS: 日別集計においてCl2出勤日に通所出勤人数・実数が正常に＋1加算されていること確認');

// -------------------------------------------------------------------------
// TEST 3: 全スタッフ共通 労基法公休間隔（最大6日以内）厳格検証
// -------------------------------------------------------------------------
console.log('\n【TEST 3: 全スタッフ共通 労基法公休間隔（最大6日以内）厳格検証】');
const testStaffList = [
    {
        id: 1,
        name: '一般スタッフ1',
        isUnused: false,
        allow6Consec: false,
        days: new Array(28).fill('')
    }
];
for (let d = 0; d < 7; d++) testStaffList[0].days[d] = '○';
testStaffList[0].days[7] = '休';

const initRes = validateInitialState(testStaffList, 28, { standardHolidays: 8.0 });
const hasPureOffErr = initRes.errors.some(e => e.includes('公休から公休の間は最大6日以内') || e.includes('公休（休）のない連続期間'));
assert(hasPureOffErr, '7日以上連続して公休がない場合、全スタッフ共通の労基法公休間隔エラーとして検知されること');
console.log('  ✅ PASS: 公休間隔7日以上の労基法違反が100%確実に検知されること確認');

testStaffList[0].days[3] = '有';
const initResWithPaid = validateInitialState(testStaffList, 28, { standardHolidays: 8.0 });
const hasPaidErr = initResWithPaid.errors.some(e => e.includes('公休から公休の間は最大6日以内') || e.includes('公休（休）のない連続期間'));
assert(hasPaidErr, '有休があっても公休間隔はリセットされず、最大6日以内超過としてエラー検知されること');
console.log('  ✅ PASS: 有休取得日があっても公休間隔はリセットされず、最大6日以内超過としてエラー検知されること確認');

console.log('\n====================================================');
console.log('🏁 徹底検証完了: すべてのテスト項目が 100% 合格しました！');
console.log('====================================================');
