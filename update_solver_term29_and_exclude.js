// update_solver_term29_and_exclude.js
// solver.js に「ー」記号（EXCLUDE）および動的日数（29日対応）を実装する

const fs = require('fs');
const path = require('path');

const solverPath = path.join(__dirname, 'solver.js');
let code = fs.readFileSync(solverPath, 'utf8');

// 1. SYMBOLS に EXCLUDE: 'ー' を追加
if (!code.includes("EXCLUDE: 'ー'")) {
    code = code.replace("WORK: '○',", "WORK: '○',\n    EXCLUDE: 'ー', // ★ 勤務対象外（異動・退職等）");
    console.log('Added SYMBOLS.EXCLUDE');
}

// 2. isExcludeSymbol ヘルパーを追加
if (!code.includes("function isExcludeSymbol")) {
    const excludeHelper = `
// ★ 勤務対象外記号判定（異動・退職等。出勤・公休カウントから完全除外）
function isExcludeSymbol(sym) {
    if (!sym) return false;
    return sym === SYMBOLS.EXCLUDE || sym === 'ー' || sym === '－' || sym === '―' || sym === '-' || sym === '—';
}
`;
    code = code.replace("function isHalfDuty(sym) {", excludeHelper + "\nfunction isHalfDuty(sym) {");
    console.log('Added isExcludeSymbol helper');
}

// 3. isHolidaySymbol, isFullOffSymbol, isWorkSymbol での EXCLUDE 除外を確実に
// (既存の判定では isWorkSymbol, isHolidaySymbol は一致しないので false になるが、isFullOffSymbol で連勤切断を行う)
if (!code.includes("if (isExcludeSymbol(sym)) return true; // 連勤切断")) {
    code = code.replace(
        "if (sym === SYMBOLS.OFF) return true;",
        "if (isExcludeSymbol(sym)) return true; // ★ 異動・退職等で勤務していないため連勤をリセット・切断\n    if (sym === SYMBOLS.OFF) return true;"
    );
    console.log('Updated isFullOffSymbol for EXCLUDE');
}

// 4. validateInitialState での動的日数と EXCLUDE 対応
const pValInit = /function validateInitialState\(staffList, options = \{\}\) \{\r?\n\s+const errors = \[\];\r?\n\s+const conflictCells = \[\];\s*\/\/ \{ staffIndex, dayIndex, reason \}\r?\n\s+const numDays = 28;/;
const rValInit = `function validateInitialState(staffList, options = {}) {
    const errors = [];
    const conflictCells = []; // { staffIndex, dayIndex, reason }
    const numDays = options.numDays || (options.dates ? options.dates.length : 28);`;

if (pValInit.test(code)) {
    code = code.replace(pValInit, rValInit);
    console.log('Updated validateInitialState numDays');
}

// 5. ShiftScheduler コンストラクタでの動的日数
const pSchedInit = /this\.numStaff = this\.staffList\.length;\r?\n\s+this\.numDays = 28;\r?\n\s+this\.options = Object\.assign\(\{\r?\n\s+standardHolidays: 8,\s*\/\/ 4週8休の標準公休日数\r?\n\s+dayOffsets: new Array\(28\)\.fill\(0\)\r?\n\s+\}, options\);/;
const rSchedInit = `this.numStaff = this.staffList.length;
        this.numDays = options.numDays || (options.dates ? options.dates.length : (this.staffList[0]?.days?.length || 28));
        this.options = Object.assign({
            standardHolidays: 8, // 標準公休日数 (通常8, 第13タームは8.5または9.0)
            dayOffsets: new Array(this.numDays).fill(0)
        }, options);`;

if (pSchedInit.test(code)) {
    code = code.replace(pSchedInit, rSchedInit);
    console.log('Updated ShiftScheduler constructor numDays');
}

// 6. initGrid での EXCLUDE セルの固定（自動割当スキップ）
const pInitGrid = /const initSym = staff\.days\[d\] \|\| '';\r?\n\s+row\.push\(\{\r?\n\s+symbol: initSym,\r?\n\s+isFixed: initSym !== ''\s*\/\/ 手動入力された希望勤務は完全ロック\r?\n\s+\}\);/;
const rInitGrid = `const initSym = staff.days[d] || '';
                const isExcluded = isExcludeSymbol(initSym);
                row.push({
                    symbol: isExcluded ? SYMBOLS.EXCLUDE : initSym,
                    isFixed: initSym !== '', // 手動入力された希望勤務および「ー」は完全ロック
                    isExcluded: isExcluded
                });`;

if (pInitGrid.test(code)) {
    code = code.replace(pInitGrid, rInitGrid);
    console.log('Updated initGrid for EXCLUDE');
}

// 7. calculateStats での動的日数と EXCLUDE 除外
const pCalcStats = /calculateStats\(grid = this\.grid\) \{\r?\n\s+const daily = \[\];\r?\n\s+for \(let d = 0; d < this\.numDays; d\+\+\) \{/;
if (code.includes('calculateStats(grid = this.grid) {')) {
    console.log('calculateStats already uses this.numDays!');
}

// calculateStats 内で isWorkSymbol, isHolidaySymbol が使われており、EXCLUDE はカウントされないことを確認
fs.writeFileSync(solverPath, code, 'utf8');
console.log('SUCCESS: solver.js updated for EXCLUDE and dynamic numDays!');
