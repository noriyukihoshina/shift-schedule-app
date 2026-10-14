const fs = require('fs');
const path = require('path');

const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

console.log('=== 33ピクセル幅固定の検証 ===');
// 1. generateExcelTableHtml 日付列
const hasHtmlDate33px = appJs.includes('th style="width:33px; min-width:33px; max-width:33px;') &&
                        appJs.includes('td style="width:33px; min-width:33px; max-width:33px; height:55px;');
console.log('1. Excel貼り付け用: 日付ヘッダー & スタッフ行日付セルが 33px 固定:', hasHtmlDate33px ? 'PASS' : 'FAIL');

// 2. generateExcelTableHtml 早・遅・E・8時列
const hasHtmlEarlyLate33px = appJs.includes('th style="width:33px; min-width:33px; max-width:33px; background-color:#f1f5f9; color:#334155; font-weight:bold; ${borderThin} ${borderThickB} text-align:center;">早</th>') &&
                             appJs.includes('<td style="width:33px; min-width:33px; max-width:33px; height:55px; font-weight:bold; color:#334155; ${borderThin} ${rowBottom} text-align:center;">${fEarly}</td>');
console.log('2. Excel貼り付け用: 早〜8時セルが 33px 固定:', hasHtmlEarlyLate33px ? 'PASS' : 'FAIL');

// 3. exportExcelSpreadsheet 本物.xlsx cols定義
const hasXlsxCols33px = appJs.includes('<col min="2" max="29" width="4.0" customWidth="1"/> <!-- B〜AC: 28日分 (33ピクセル固定) -->') &&
                        appJs.includes('<col min="34" max="37" width="4.0" customWidth="1"/> <!-- AH〜AK: 早, 遅, E, 8時 (33ピクセル固定) -->');
console.log('3. 本物.xlsx: 28日分および早〜8時の列幅が 4.0 (33ピクセル固定):', hasXlsxCols33px ? 'PASS' : 'FAIL');

console.log('=== 検証完了 ===');
