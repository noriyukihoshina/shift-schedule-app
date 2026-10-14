const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, 'app.js');
let content = fs.readFileSync(appJsPath, 'utf8');

// 1. generateExcelTableHtml 内のカウンター行の行高さを 45px -> 38px に置換
// 対象: 出勤人数合計〜8時の tr と th/td の height:45px
// 注意: スタッフ行は height:33px のまま維持

// generateExcelTableHtml の開始位置と終了位置を特定
const fnStart = content.indexOf('function generateExcelTableHtml(');
const fnEnd = content.indexOf('function exportExcelSpreadsheet(');

if (fnStart === -1 || fnEnd === -1) {
    console.error('Function positions not found!');
    process.exit(1);
}

let fnPart = content.substring(fnStart, fnEnd);
// tfoot 内の height:45px を height:38px に置換
const tfootIdx = fnPart.indexOf('<tfoot>');
if (tfootIdx !== -1) {
    let tfootPart = fnPart.substring(tfootIdx);
    tfootPart = tfootPart.replace(/height:\s*45px/g, 'height:38px');
    tfootPart = tfootPart.replace(/行高45px固定/g, '行高38px固定');
    fnPart = fnPart.substring(0, tfootIdx) + tfootPart;
}

// 2. exportExcelSpreadsheet 内のカウンター行の行高さを ht="33.75" -> ht="28.5" (38px) に置換
let exportPart = content.substring(fnEnd);
exportPart = exportPart.replace(/ht="33\.75"/g, 'ht="28.5"');
exportPart = exportPart.replace(/行高45px固定/g, '行高38px固定');

content = content.substring(0, fnStart) + fnPart + exportPart;
fs.writeFileSync(appJsPath, content, 'utf8');
console.log('SUCCESS: Updated counter row height to 38px (ht="28.5") in app.js!');
