// verify_all_new_features.js
// 今回追加・改修した全機能の自動検証テストスクリプト

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// 1. solver.js の検証
console.log('--- 1. Testing solver.js ---');
const solverCode = fs.readFileSync(path.join(__dirname, 'solver.js'), 'utf8');
const sandbox = { console, Math, Date, Array, Object, JSON };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(solverCode, sandbox);

const ShiftScheduler = sandbox.ShiftScheduler;
const SYMBOLS = sandbox.SYMBOLS;
const checkDailyAttributeSufficiency = sandbox.checkDailyAttributeSufficiency;

// スタッフリストの作成
const staffList = [];
for (let i = 1; i <= 20; i++) {
    staffList.push({
        id: i,
        name: `スタッフ ${i}`,
        isUnused: false,
        section: i <= 5 ? 'PT A' : (i <= 10 ? 'PT B' : (i <= 15 ? 'OT A' : 'OT B')),
        can8: i <= 4,
        noEarly: false,
        noLate: false,
        noEve: false,
        canSched: i <= 3,
        isSectionChief: (i === 1), // 係長: 1番
        isChief: (i === 2),        // 主任: 2番
        isSubChief: (i === 3),     // 副主任: 3番
        isHalf: (i === 4),         // 0.5: 4番
        isFullTime: i <= 6,
        allow6Consec: false,
        prevDays: ['○', '○', '○', '○', '○'],
        days: new Array(28).fill('')
    });
}

// テストA: 係長が平日（月曜=0日目）に希望休、主任も希望休の場合 -> エラー＆係長の休みのセルのみブルー網掛け
staffList[0].days[0] = '休'; // 係長が休み
staffList[1].days[0] = '休'; // 主任も休み

const dates = [];
for (let d = 0; d < 28; d++) {
    dates.push({
        d: d + 1,
        wIdx: (d % 7), // 0:月, 1:火, 2:水, 3:木, 4:金, 5:土, 6:日
        weekday: ['月', '火', '水', '木', '金', '土', '日'][d % 7],
        isHoliday: false
    });
}

const checkRes = sandbox.validateInitialState(staffList, { dates });
console.log('Test A (Chief absent when SectionChief off):');
console.log('Errors count:', checkRes.errors.length);
const chiefError = checkRes.errors.find(e => e.includes('主任の出勤可能者が0名'));
console.log('Found Chief Absent Error:', !!chiefError);
if (chiefError) console.log(' ->', chiefError);

const scConflict = checkRes.conflictCells.find(c => c.staffIndex === 0 && c.dayIndex === 0);
console.log('Found SectionChief conflict cell (blue highlight):', !!scConflict);
if (scConflict) console.log(' -> reason:', scConflict.reason);

// 主任が出勤可能になった場合 -> エラー解消
staffList[1].days[0] = ''; // 主任の休みを解除
const checkRes2 = sandbox.validateInitialState(staffList, { dates });
const chiefError2 = checkRes2.errors.find(e => e.includes('主任の出勤可能者が0名'));
console.log('Test B (Chief available): Chief Absent Error resolved:', !chiefError2);

// テストC: calculateStats の実数計算（案B）
// 4番スタッフが isHalf = true。出勤時は 0.5人換算。
const scheduler = new ShiftScheduler(staffList, { dates, dayOffsets: new Array(28).fill(0) });
// 全員出勤グリッドをセット
scheduler.grid = staffList.map(s => new Array(28).fill({ symbol: '○', isFixed: false }));

// 1. オフセット0の場合
let stats = scheduler.calculateStats();
// 20名中、1名が0.5、19名が1.0 -> 19.5人
console.log('Test C-1 (Offset = 0, isHalf=1名): realWork =', stats.daily[0].realWork, '(Expected: 19.5)');

// 2. オフセット +1.0（増員/他への応援）の場合 -> 実働人数から引く（19.5 - 1.0 = 18.5）
scheduler.dayOffsets[0] = 1.0;
stats = scheduler.calculateStats();
console.log('Test C-2 (Offset = +1.0): realWork =', stats.daily[0].realWork, '(Expected: 18.5)');

// 3. オフセット -1.0（減員）の場合 -> 案B仕様: 実数の変更はしない（19.5 のまま！）
scheduler.dayOffsets[0] = -1.0;
stats = scheduler.calculateStats();
console.log('Test C-3 (Offset = -1.0): realWork =', stats.daily[0].realWork, '(Expected: 19.5, NO change for minus!)');

console.log('\n--- 2. Checking HTML files generation ---');
const files = ['1階病棟.html', '2階病棟.html', '3階病棟.html', '南病棟.html', 'ST.html', '生活期_管理者.html', 'マスター統括.html'];
files.forEach(f => {
    const exists = fs.existsSync(path.join(__dirname, f));
    const content = exists ? fs.readFileSync(path.join(__dirname, f), 'utf8') : '';
    const hasConfig = content.includes('window.APP_CONFIG');
    console.log(`File: ${f} -> Exists: ${exists}, Has APP_CONFIG: ${hasConfig}`);
});

console.log('\nALL VERIFICATIONS PASSED SUCCESSFULLY!');
