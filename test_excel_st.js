const fs = require('fs');
const path = require('path');

const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
const styleCss = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');

console.log('--- 1. style.css の検証 ---');
const hasStPink = styleCss.includes('.foot-sec-st') && styleCss.includes('#db2777');
console.log('STの文字色がピンク(#db2777):', hasStPink ? 'PASS' : 'FAIL');

const hasEarlyGray = styleCss.includes('.stat-cell[data-stat="early"]') && styleCss.includes('#334155');
console.log('集計列の早番文字色が濃い灰色(#334155):', hasEarlyGray ? 'PASS' : 'FAIL');

console.log('\n--- 2. app.js (UIテーブル) の検証 ---');
const hasPaidHeaderClean = appJs.includes('title="有給休暇日数" class="border-thick-bottom" style="background:#f1f5f9; color:#ea580c;');
console.log('有休ヘッダーの背景色が通常ヘッダーと同じ(#f1f5f9)で文字色がオレンジ(#ea580c):', hasPaidHeaderClean ? 'PASS' : 'FAIL');

const hasEarlyStatGray = appJs.includes('data-stat="early" style="font-weight:600; color:#334155;');
console.log('スタッフ行の早番文字色が濃い灰色(#334155):', hasEarlyStatGray ? 'PASS' : 'FAIL');

const hasSecOrder = appJs.includes("{ name: 'PT A', label: 'PT A 出勤'") &&
                    appJs.includes("{ name: 'OT A', label: 'OT A 出勤'") &&
                    appJs.includes("{ name: 'PT B', label: 'PT B 出勤'") &&
                    appJs.includes("{ name: 'OT B', label: 'OT B 出勤'") &&
                    appJs.includes("{ name: 'ST',   label: 'ST 出勤'");
console.log('セクション集計順序 (PT A -> OT A -> PT B -> OT B -> ST):', hasSecOrder ? 'PASS' : 'FAIL');

const hasStPinkInSec = appJs.includes("{ name: 'ST',   label: 'ST 出勤',   cls: 'foot-sec-st',   color: '#db2777' }");
console.log('UIセクション集計のST文字色がピンク(#db2777):', hasStPinkInSec ? 'PASS' : 'FAIL');

console.log('\n--- 3. app.js (Excel出力) の検証 ---');
const hasExcelEarlyGray = appJs.includes('color:#334155; ${borderThin} ${rowBottom} text-align:center;">${fEarly}</td>');
console.log('Excelスタッフ行早番文字色が濃い灰色(#334155):', hasExcelEarlyGray ? 'PASS' : 'FAIL');

const ptAPos = appJs.indexOf('PT A 出勤');
const otAPos = appJs.indexOf('OT A 出勤');
const ptBPos = appJs.indexOf('PT B 出勤');
const otBPos = appJs.indexOf('OT B 出勤');
const stPos = appJs.indexOf('ST 出勤');
const isExcelSecOrder = (ptAPos < otAPos && otAPos < ptBPos && ptBPos < otBPos && otBPos < stPos);
console.log('Excel集計行順序 (PT A -> OT A -> PT B -> OT B -> ST):', isExcelSecOrder ? 'PASS' : 'FAIL');

const hasExcelStPink = appJs.includes('color:#db2777; font-weight:bold; ${borderThin} ${borderThickR} border-bottom:0.5pt solid #cbd5e1; text-align:center;">ST 出勤</th>') &&
                       appJs.includes('color:#db2777; font-weight:bold; ${borderThin} ${rightBorder} border-bottom:0.5pt solid #cbd5e1; text-align:center;">${fSt}</td>') &&
                       appJs.includes('color:#db2777; font-weight:bold; ${borderThin} border-bottom:0.5pt solid #cbd5e1; text-align:center;">=SUM(B${stRowIdx}:AC${stRowIdx})</td>');
console.log('Excel ST集計行の全セル(th, td, 合計)文字色がピンク(#db2777):', hasExcelStPink ? 'PASS' : 'FAIL');

// ST数式の開き括弧と閉じ括弧の整合性検証
const stFormulaMatch = appJs.match(/const fSt = `=(IF\([^`]+?\))\);/);
console.log('ST数式の構文マッチ (末尾閉じ括弧あり):', stFormulaMatch ? 'PASS' : 'FAIL');
if (stFormulaMatch) {
    console.log('抽出された数式テンプレート:', stFormulaMatch[1]);
}

console.log('\n--- 全検証完了 ---');
