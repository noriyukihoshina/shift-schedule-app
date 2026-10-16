const fs = require('fs');
const path = require('path');

const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
const styleCss = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

console.log('=== 要望1: カウンターの色変更検証 ===');
// PT A & OT A はオレンジ (#ea580c)
const cssPtAOtAOrange = styleCss.includes('.foot-sec-pt-a,\n.foot-sec-ot-a') && styleCss.includes('#ea580c');
console.log('CSS: PT A & OT A がオレンジ(#ea580c):', cssPtAOtAOrange ? 'PASS' : 'FAIL');

// PT B & OT B は青 (#1d4ed8)
const cssPtBOtBBlue = styleCss.includes('.foot-sec-pt-b,\n.foot-sec-ot-b') && styleCss.includes('#1d4ed8');
console.log('CSS: PT B & OT B が青(#1d4ed8):', cssPtBOtBBlue ? 'PASS' : 'FAIL');

// ST は薄いピンク (#ec4899)
const cssStPink = styleCss.includes('.foot-sec-st') && styleCss.includes('#ec4899');
console.log('CSS: ST が薄いピンク(#ec4899):', cssStPink ? 'PASS' : 'FAIL');

// UIの secList
const jsSecList = appJs.includes("{ name: 'PT A', label: 'PT A 出勤', cls: 'foot-sec-pt-a', color: '#ea580c' }") &&
                  appJs.includes("{ name: 'OT A', label: 'OT A 出勤', cls: 'foot-sec-ot-a', color: '#ea580c' }") &&
                  appJs.includes("{ name: 'PT B', label: 'PT B 出勤', cls: 'foot-sec-pt-b', color: '#1d4ed8' }") &&
                  appJs.includes("{ name: 'OT B', label: 'OT B 出勤', cls: 'foot-sec-ot-b', color: '#1d4ed8' }") &&
                  appJs.includes("{ name: 'ST',   label: 'ST 出勤',   cls: 'foot-sec-st',   color: '#ec4899' }");
console.log('JS: UI secList の色と順序:', jsSecList ? 'PASS' : 'FAIL');

console.log('\n=== 要望2: 公休・有休・リフの黒字化検証 ===');
// CSS: 公休・有休・リフは黒
const cssStatBlack = styleCss.includes('.stat-cell[data-stat="off"]') &&
                     styleCss.includes('.stat-cell[data-stat="paid"]') &&
                     styleCss.includes('.stat-cell[data-stat="ref"]') &&
                     styleCss.includes('#1e293b');
console.log('CSS: 右側集計列の公休・有休・リフが黒(#1e293b):', cssStatBlack ? 'PASS' : 'FAIL');

// UIテーブル: ヘッダー
const uiHeaderBlack = appJs.includes('title="公休日数" class="border-thick-bottom" style="background:#f1f5f9; color:#1e293b;') &&
                      appJs.includes('title="有給休暇日数" class="border-thick-bottom" style="background:#f1f5f9; color:#1e293b;') &&
                      appJs.includes('title="リフレッシュ休暇日数" class="border-thick-bottom" style="background:#f1f5f9; color:#1e293b;');
console.log('JS: UIヘッダーの公休・有休・リフが黒(#1e293b):', uiHeaderBlack ? 'PASS' : 'FAIL');

// UIテーブル: スタッフ行
const uiStaffBlack = appJs.includes('data-stat="off" style="font-weight:700; color:#1e293b;') &&
                     appJs.includes('data-stat="paid" style="font-weight:800; color:#1e293b;') &&
                     appJs.includes('data-stat="ref" style="font-weight:600; color:#1e293b;');
console.log('JS: UIスタッフ行の公休・有休・リフが黒(#1e293b):', uiStaffBlack ? 'PASS' : 'FAIL');

// Excelテーブル: 黒字化
const excelStatBlack = appJs.includes('color:#000000; ${borderThin} ${rowBottom} text-align:center;">${fOff}</td>') &&
                       appJs.includes('color:#000000; background-color:transparent; ${borderThin} ${rowBottom} text-align:center;">${fPaid}</td>') &&
                       appJs.includes('color:#000000; ${borderThin} ${rowBottom} text-align:center;">${fRef}</td>');
console.log('JS: Excel貼り付けテーブルの公休・有休・リフが黒(#000000):', excelStatBlack ? 'PASS' : 'FAIL');

console.log('\n=== 要望3: 名前部分の幅縮小 & 印刷設定固定検証 ===');
// Excelテーブルの名前列幅 115px化
const excelNameWidth = appJs.includes('width:115px; min-width:115px; max-width:115px; height:55px; text-align:left; font-weight:bold;');
console.log('JS: Excel貼り付けテーブルの氏名列幅が115px:', excelNameWidth ? 'PASS' : 'FAIL');

// .xlsx 出力での A3横向き・狭い余白・1ページ印刷設定
const hasPageSetup = appJs.includes('paperSize="8"') &&
                     appJs.includes('orientation="landscape"') &&
                     appJs.includes('fitToWidth="1"') &&
                     appJs.includes('fitToPage="1"');
console.log('JS: 本物.xlsx 内にA3横・1ページ印刷設定(paperSize=8, orientation=landscape, fitToWidth=1):', hasPageSetup ? 'PASS' : 'FAIL');

console.log('\n=== 要望4: 本物.xlsx化（保護ビュー・形式不一致警告の完全根絶） ===');
const hasRealXlsxMime = appJs.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
console.log('JS: 本物.xlsx MIMEタイプ使用:', hasRealXlsxMime ? 'PASS' : 'FAIL');

const hasXlsxExt = appJs.includes('.xlsx');
console.log('JS: ダウンロード拡張子が.xlsx:', hasXlsxExt ? 'PASS' : 'FAIL');

const htmlBtnXlsx = indexHtml.includes('スプレッドシート保存 (.xlsx)');
console.log('HTML: ボタン表示が「スプレッドシート保存 (.xlsx)」:', htmlBtnXlsx ? 'PASS' : 'FAIL');

console.log('\n=== 全項目テスト完了 ===');
