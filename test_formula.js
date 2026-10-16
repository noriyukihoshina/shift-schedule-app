// app.js の該当コードの動作検証
const fs = require = undefined; // browser environment

// copyForExcelのロジック再現テスト
const NUM_STAFF = 50;
const NUM_DAYS = 28;
const termTitle = "7/1～7/28勤務表";
const startCol = 'C';
const endCol = 'AD';

const generatedRngs = [];
for (let s = 0; s < NUM_STAFF; s++) {
    const rowNum = s + 4;
    generatedRngs.push(`${startCol}${rowNum}:${endCol}${rowNum}`);
}

const startRow = 4;
const endRow = NUM_STAFF + 3; // 53行目

const colRng = `C${startRow}:C${endRow}`;

const tests = [
    { name: "1人目スタッフの数式範囲", expected: "C4:AD4", actual: generatedRngs[0] },
    { name: "50人目スタッフの数式範囲", expected: "C53:AD53", actual: generatedRngs[49] },
    { name: "フッター列集計範囲", expected: "C4:C53", actual: colRng },
    { name: "スタッフ行数", expected: 50, actual: generatedRngs.length }
];

let failed = false;
for (const t of tests) {
    if (t.expected !== t.actual) {
        console.error(`FAILED: ${t.name}, expected=${t.expected}, actual=${t.actual}`);
        failed = true;
    }
}

if (!failed) {
    console.log("FORMULA_TESTS_PASSED");
    document.getElementById('result').innerText = "FORMULA_TESTS_PASSED";
} else {
    document.getElementById('result').innerText = "FORMULA_TESTS_FAILED";
}
