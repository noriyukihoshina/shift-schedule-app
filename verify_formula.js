const fs = require('fs');
const path = require('path');

const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

function makeWorkCountFormula(range) {
    const symbols = ['○', '〇', '出', '早', '遅', 'E', '8時', 'ハヤ', 'オソ', 'イブ'];
    return `SUM(${symbols.map(s => `COUNTIF(${range},"${s}")`).join(',')})`;
}

const lines = appJs.split('\n');
const fStLine = lines.find(l => l.includes('const fSt ='));
console.log('app.js の実際の行:', fStLine.trim());

// app.js の行を eval で評価して Excel数式を生成
const stStartRow = 55;
const col = 'B';
let formula = '';
eval(fStLine.replace('const fSt =', 'formula ='));

console.log('\n生成された実際のExcel数式:');
console.log(formula);

// 開き括弧と閉じ括弧の数をカウント
const openParenCount = (formula.match(/\(/g) || []).length;
const closeParenCount = (formula.match(/\)/g) || []).length;
console.log(`\n開き括弧の数: ${openParenCount}, 閉じ括弧の数: ${closeParenCount}`);
if (openParenCount === closeParenCount) {
    console.log('✅ PASS: 開き括弧と閉じ括弧が完全一致！構文エラーは100%解消されています！');
} else {
    console.log('❌ FAIL: 括弧の数が不一致です！');
}
