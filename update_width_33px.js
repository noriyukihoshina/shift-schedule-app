const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, 'app.js');
let appJs = fs.readFileSync(appJsPath, 'utf8');

// 1. generateExcelTableHtml 内の日付列セル幅を 33px に変更
// 日付ヘッダー
appJs = appJs.replace(
    'tableHtml += `    <th style="width:115px; min-width:115px; max-width:115px; background-color:${bg};',
    'tableHtml += `    <th style="width:33px; min-width:33px; max-width:33px; background-color:${bg};'
);

// スタッフ行の日付セル
appJs = appJs.replace(
    'tableHtml += `    <td style="width:115px; height:55px; color:#DC2626 !important; font-weight:bold !important; background-color:transparent !important;',
    'tableHtml += `    <td style="width:33px; min-width:33px; max-width:33px; height:55px; color:#DC2626 !important; font-weight:bold !important; background-color:transparent !important;'
);
appJs = appJs.replace(
    'tableHtml += `    <td style="width:115px; height:55px; color:#1E293B !important; font-weight:normal;',
    'tableHtml += `    <td style="width:33px; min-width:33px; max-width:33px; height:55px; color:#1E293B !important; font-weight:normal;'
);

// スタッフ行の早・遅・E・8時セル (75px -> 33px)
appJs = appJs.replace(
    '<td style="width:75px; height:55px; font-weight:bold; color:#334155; ${borderThin} ${rowBottom} text-align:center;">${fEarly}</td>',
    '<td style="width:33px; min-width:33px; max-width:33px; height:55px; font-weight:bold; color:#334155; ${borderThin} ${rowBottom} text-align:center;">${fEarly}</td>'
);
appJs = appJs.replace(
    '<td style="width:75px; height:55px; font-weight:bold; color:#334155; ${borderThin} ${rowBottom} text-align:center;">${fLate}</td>',
    '<td style="width:33px; min-width:33px; max-width:33px; height:55px; font-weight:bold; color:#334155; ${borderThin} ${rowBottom} text-align:center;">${fLate}</td>'
);
appJs = appJs.replace(
    '<td style="width:75px; height:55px; font-weight:bold; color:#334155; ${borderThin} ${rowBottom} text-align:center;">${fEve}</td>',
    '<td style="width:33px; min-width:33px; max-width:33px; height:55px; font-weight:bold; color:#334155; ${borderThin} ${rowBottom} text-align:center;">${fEve}</td>'
);
appJs = appJs.replace(
    '<td style="width:75px; height:55px; font-weight:bold; color:#334155; ${borderThin} ${rowBottom} text-align:center;">${fH8}</td>',
    '<td style="width:33px; min-width:33px; max-width:33px; height:55px; font-weight:bold; color:#334155; ${borderThin} ${rowBottom} text-align:center;">${fH8}</td>'
);

// ヘッダーの早・遅・E・8時 (75px -> 33px)
appJs = appJs.replace(
    '<th style="width:75px; background-color:#f1f5f9; color:#334155; font-weight:bold; ${borderThin} ${borderThickB} text-align:center;">早</th>',
    '<th style="width:33px; min-width:33px; max-width:33px; background-color:#f1f5f9; color:#334155; font-weight:bold; ${borderThin} ${borderThickB} text-align:center;">早</th>'
);
appJs = appJs.replace(
    '<th style="width:75px; background-color:#f1f5f9; color:#334155; font-weight:bold; ${borderThin} ${borderThickB} text-align:center;">遅</th>',
    '<th style="width:33px; min-width:33px; max-width:33px; background-color:#f1f5f9; color:#334155; font-weight:bold; ${borderThin} ${borderThickB} text-align:center;">遅</th>'
);
appJs = appJs.replace(
    '<th style="width:75px; background-color:#f1f5f9; color:#334155; font-weight:bold; ${borderThin} ${borderThickB} text-align:center;">E</th>',
    '<th style="width:33px; min-width:33px; max-width:33px; background-color:#f1f5f9; color:#334155; font-weight:bold; ${borderThin} ${borderThickB} text-align:center;">E</th>'
);
appJs = appJs.replace(
    '<th style="width:75px; background-color:#f1f5f9; color:#334155; font-weight:bold; ${borderThin} ${borderThickB} text-align:center;">8時</th>',
    '<th style="width:33px; min-width:33px; max-width:33px; background-color:#f1f5f9; color:#334155; font-weight:bold; ${borderThin} ${borderThickB} text-align:center;">8時</th>'
);

// 出勤人数合計行の早・遅・E・8時 (75px -> 33px)
appJs = appJs.replace(
    '<td style="width:75px; height:45px; font-weight:bold; color:#334155; ${borderThin} border-bottom:1pt solid #64748b; text-align:center;">=SUM(INDIRECT("AH$4:AH"&(ROW()-1)))</td>',
    '<td style="width:33px; min-width:33px; max-width:33px; height:45px; font-weight:bold; color:#334155; ${borderThin} border-bottom:1pt solid #64748b; text-align:center;">=SUM(INDIRECT("AH$4:AH"&(ROW()-1)))</td>'
);
appJs = appJs.replace(
    '<td style="width:75px; height:45px; font-weight:bold; color:#334155; ${borderThin} border-bottom:1pt solid #64748b; text-align:center;">=SUM(INDIRECT("AI$4:AI"&(ROW()-1)))</td>',
    '<td style="width:33px; min-width:33px; max-width:33px; height:45px; font-weight:bold; color:#334155; ${borderThin} border-bottom:1pt solid #64748b; text-align:center;">=SUM(INDIRECT("AI$4:AI"&(ROW()-1)))</td>'
);
appJs = appJs.replace(
    '<td style="width:75px; height:45px; font-weight:bold; color:#334155; ${borderThin} border-bottom:1pt solid #64748b; text-align:center;">=SUM(INDIRECT("AJ$4:AJ"&(ROW()-1)))</td>',
    '<td style="width:33px; min-width:33px; max-width:33px; height:45px; font-weight:bold; color:#334155; ${borderThin} border-bottom:1pt solid #64748b; text-align:center;">=SUM(INDIRECT("AJ$4:AJ"&(ROW()-1)))</td>'
);
appJs = appJs.replace(
    '<td style="width:75px; height:45px; font-weight:bold; color:#334155; ${borderThin} border-bottom:1pt solid #64748b; text-align:center;">=SUM(INDIRECT("AK$4:AK"&(ROW()-1)))</td>',
    '<td style="width:33px; min-width:33px; max-width:33px; height:45px; font-weight:bold; color:#334155; ${borderThin} border-bottom:1pt solid #64748b; text-align:center;">=SUM(INDIRECT("AK$4:AK"&(ROW()-1)))</td>'
);

// 各フッター行（出勤人数合計、実数合計、PT A, OT A, PT B, OT B, ST, 早, 遅, E, 8時）の日付セル (115px -> 33px)
appJs = appJs.replace(
    /tableHtml \+= `    <td style="width:115px; height:45px;/g,
    'tableHtml += `    <td style="width:33px; min-width:33px; max-width:33px; height:45px;'
);

// 2. 本物 .xlsx 生成 (exportExcelSpreadsheet) の cols 定義
// 現在:
//     <col min="2" max="29" width="4.8" customWidth="1"/> <!-- B〜AC: 28日分 -->
//     <col min="30" max="33" width="7" customWidth="1"/> <!-- AD〜AG: 出勤, 公休, 有休, リフ (黒字) -->
//     <col min="34" max="37" width="5.5" customWidth="1"/> <!-- AH〜AK: 早, 遅, E, 8時 -->
// これを 33ピクセル（width="4.0"）に完全固定！
appJs = appJs.replace(
    '<col min="2" max="29" width="4.8" customWidth="1"/>',
    '<col min="2" max="29" width="4.0" customWidth="1"/> <!-- B〜AC: 28日分 (33ピクセル固定) -->'
);
appJs = appJs.replace(
    '<col min="34" max="37" width="5.5" customWidth="1"/>',
    '<col min="34" max="37" width="4.0" customWidth="1"/> <!-- AH〜AK: 早, 遅, E, 8時 (33ピクセル固定) -->'
);

fs.writeFileSync(appJsPath, appJs, 'utf8');
console.log('SUCCESS: Successfully updated widths to 33px in both generateExcelTableHtml and exportExcelSpreadsheet!');
