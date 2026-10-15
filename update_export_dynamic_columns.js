// update_export_dynamic_columns.js
// exportExcelSpreadsheet の列および数式を、動的日数（28日/29日）に完全追従させるスクリプト

const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, 'app.js');
let code = fs.readFileSync(appPath, 'utf8');

const fnStart = code.indexOf('function exportExcelSpreadsheet(grid, stats)');
if (fnStart === -1) {
    console.error('exportExcelSpreadsheet not found!');
    process.exit(1);
}

// exportExcelSpreadsheet の関数全体を抽出
const nextFn = code.indexOf('\n    // 初期起動', fnStart);
const oldFn = code.substring(fnStart, nextFn);

// 動的列計算を用いた新しい exportExcelSpreadsheet 関数を構築
const newFn = `function exportExcelSpreadsheet(grid, stats) {
        const term = getTermInfo();
        const numDays = term.dates.length;
        const safeTitle = \`\${term.first.m}月\${term.first.day}日～\${term.last.m}月\${term.last.day}日 勤務表\`;
        // シート名禁則文字 (: \\ / ? * [ ]) を全角またはハイフンにサニタイズ
        const sanitizedSheetName = \`\${term.first.m}月\${term.first.day}日～\${term.last.m}月\${term.last.day}日勤務表\`
            .replace(/[/\\\\?*\\[\\]:]/g, '_')
            .substring(0, 31);
        const title = safeTitle;

        // 動的列レターの算出
        const firstDayCol = 'B'; // 列2
        const lastDayCol = toColLetter(1 + numDays); // 28日: AC(列29), 29日: AD(列30)
        const colWork = toColLetter(2 + numDays);    // 28日: AD, 29日: AE
        const colOff = toColLetter(3 + numDays);     // 28日: AE, 29日: AF
        const colPaid = toColLetter(4 + numDays);    // 28日: AF, 29日: AG
        const colRef = toColLetter(5 + numDays);     // 28日: AG, 29日: AH
        const colEarly = toColLetter(6 + numDays);   // 28日: AH, 29日: AI
        const colLate = toColLetter(7 + numDays);    // 28日: AI, 29日: AJ
        const colEve = toColLetter(8 + numDays);     // 28日: AJ, 29日: AK
        const colH8 = toColLetter(9 + numDays);      // 28日: AK, 29日: AL
        const colRemarks = toColLetter(10 + numDays); // 28日: AL, 29日: AM

        const contentTypes = \`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>\`;

        const rels = \`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>\`;

        const workbook = \`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="\${sanitizedSheetName}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>\`;

        const wbRels = \`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>\`;

        const styles = \`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="10">
    <font><sz val="9"/><name val="Meiryo"/><color rgb="000000"/></font>
    <font><b/><sz val="9"/><name val="Meiryo"/><color rgb="000000"/></font>
    <font><b/><sz val="9"/><name val="Meiryo"/><color rgb="DC2626"/></font>
    <font><b/><sz val="12"/><name val="Meiryo"/><color rgb="1E293B"/></font>
    <font><b/><sz val="9"/><name val="Meiryo"/><color rgb="EA580C"/></font>
    <font><b/><sz val="9"/><name val="Meiryo"/><color rgb="1D4ED8"/></font>
    <font><b/><sz val="9"/><name val="Meiryo"/><color rgb="EC4899"/></font>
    <font><b/><sz val="9"/><name val="Meiryo"/><color rgb="15803D"/></font>
    <font><b/><sz val="9"/><name val="Meiryo"/><color rgb="7C3AED"/></font>
    <font><sz val="9"/><name val="Meiryo"/><color rgb="64748B"/></font>
  </fonts>
  <fills count="7">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="F1F5F9"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="EFF6FF"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FEF2F2"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="F8FAFC"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="F0FDF4"/></patternFill></fill>
  </fills>
  <borders count="4">
    <border><left/><right/><top/><bottom/></border>
    <border>
      <left style="thin"><color rgb="CBD5E1"/></left>
      <right style="thin"><color rgb="CBD5E1"/></right>
      <top style="thin"><color rgb="CBD5E1"/></top>
      <bottom style="thin"><color rgb="CBD5E1"/></bottom>
    </border>
    <border>
      <left style="thin"><color rgb="CBD5E1"/></left>
      <right style="medium"><color rgb="64748B"/></right>
      <top style="thin"><color rgb="CBD5E1"/></top>
      <bottom style="thin"><color rgb="CBD5E1"/></bottom>
    </border>
    <border>
      <left style="thin"><color rgb="CBD5E1"/></left>
      <right style="thin"><color rgb="CBD5E1"/></right>
      <top style="thin"><color rgb="CBD5E1"/></top>
      <bottom style="medium"><color rgb="64748B"/></bottom>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="15">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="6" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="9" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment horizontal="left" vertical="center"/></xf>
  </cellXfs>
</styleSheet>\`;

        // 有効スタッフのみ抽出
        const validStaffIndices = [];
        staffList.forEach((s, idx) => {
            if (!s.isUnused) validStaffIndices.push(idx);
        });

        // ワークカウント数式ヘルパー (○, 〇, 出, 早, 遅, E, 8時, ハヤ, オソ, イブ + 半休0.5)
        function makeWorkCountFormulaXml(rRng) {
            return \`COUNTIF(\${rRng},&quot;○&quot;)+COUNTIF(\${rRng},&quot;〇&quot;)+COUNTIF(\${rRng},&quot;出&quot;)+COUNTIF(\${rRng},&quot;早&quot;)+COUNTIF(\${rRng},&quot;遅&quot;)+COUNTIF(\${rRng},&quot;E&quot;)+COUNTIF(\${rRng},&quot;8時&quot;)+COUNTIF(\${rRng},&quot;ハヤ&quot;)+COUNTIF(\${rRng},&quot;オソ&quot;)+COUNTIF(\${rRng},&quot;イブ&quot;)+0.5*(COUNTIF(\${rRng},&quot;○/休&quot;)+COUNTIF(\${rRng},&quot;〇/休&quot;)+COUNTIF(\${rRng},&quot;休/○&quot;)+COUNTIF(\${rRng},&quot;休/〇&quot;)+COUNTIF(\${rRng},&quot;○/有&quot;)+COUNTIF(\${rRng},&quot;〇/有&quot;)+COUNTIF(\${rRng},&quot;有/○&quot;)+COUNTIF(\${rRng},&quot;有/〇&quot;))\`;
        }

        // リフレッシュ休暇数式ヘルパー
        function makeRefHolidayFormulaXml(rRng) {
            return \`COUNTIF(\${rRng},&quot;上1&quot;)+COUNTIF(\${rRng},&quot;上2&quot;)+COUNTIF(\${rRng},&quot;上3&quot;)+COUNTIF(\${rRng},&quot;上4&quot;)+COUNTIF(\${rRng},&quot;上5&quot;)+COUNTIF(\${rRng},&quot;下1&quot;)+COUNTIF(\${rRng},&quot;下2&quot;)+COUNTIF(\${rRng},&quot;下3&quot;)\`;
        }

        let sheet1 = \`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews>
    <sheetView tabSelected="1" workbookViewId="0">
      <pane ySplit="3" xSplit="1" topLeftCell="B4" activePane="bottomRight" state="frozen"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="18" customHeight="1"/>
  <cols>
    <col min="1" max="1" width="16" customWidth="1"/>\`;

        // 日付列: 幅4.2
        for (let d = 0; d < numDays; d++) {
            sheet1 += \`\\n    <col min="\${2 + d}" max="\${2 + d}" width="4.2" customWidth="1"/>\`;
        }
        // 集計列: 幅5.5
        for (let c = 2 + numDays; c <= 9 + numDays; c++) {
            sheet1 += \`\\n    <col min="\${c}" max="\${c}" width="5.5" customWidth="1"/>\`;
        }
        // 備考欄 (メモ): 幅162 (約1300ピクセル相当)
        sheet1 += \`\\n    <col min="\${10 + numDays}" max="\${10 + numDays}" width="162" customWidth="1"/>\`;
        sheet1 += \`\\n  </cols>
  <sheetData>
    <row r="1" ht="28" customHeight="1">
      <c r="A1" s="1" t="inlineStr"><is><t>\${title}</t></is></c>
      <c r="\${colWork}1" s="2" t="inlineStr"><is><t>勤務・休暇 集計</t></is></c>
    </row>
    <row r="2" ht="24" customHeight="1">
      <c r="A2" s="2" t="inlineStr"><is><t>氏名</t></is></c>\`;

        for (let d = 0; d < numDays; d++) {
            const di = term.dates[d];
            const col = toColLetter(2 + d);
            sheet1 += \`\\n      <c r="\${col}2" s="2" t="inlineStr"><is><t>\${di.label || di.day}</t></is></c>\`;
        }
        sheet1 += \`\\n      <c r="\${colWork}2" s="2" t="inlineStr"><is><t>出勤</t></is></c>
      <c r="\${colOff}2" s="2" t="inlineStr"><is><t>公休</t></is></c>
      <c r="\${colPaid}2" s="2" t="inlineStr"><is><t>有休</t></is></c>
      <c r="\${colRef}2" s="2" t="inlineStr"><is><t>リフ</t></is></c>
      <c r="\${colEarly}2" s="2" t="inlineStr"><is><t>早</t></is></c>
      <c r="\${colLate}2" s="2" t="inlineStr"><is><t>遅</t></is></c>
      <c r="\${colEve}2" s="2" t="inlineStr"><is><t>E</t></is></c>
      <c r="\${colH8}2" s="2" t="inlineStr"><is><t>8時</t></is></c>
      <c r="\${colRemarks}2" s="2" t="inlineStr"><is><t>備考（メモ）</t></is></c>
    </row>\`;

        // 3行目: 曜日ヘッダー行
        sheet1 += \`\\n    <row r="3" ht="20" customHeight="1">
      <c r="A3" s="2"/>\`;
        for (let d = 0; d < numDays; d++) {
            const di = term.dates[d];
            const col = toColLetter(2 + d);
            let sIdx = 2;
            if (di.wIdx === 5) sIdx = 3; // 土曜青
            else if (di.wIdx === 6 || di.isHoliday) sIdx = 4; // 日祝赤
            sheet1 += \`\\n      <c r="\${col}3" s="\${sIdx}" t="inlineStr"><is><t>\${di.weekday || di.w}</t></is></c>\`;
        }
        sheet1 += \`\\n      <c r="\${colWork}3" s="2"/><c r="\${colOff}3" s="2"/><c r="\${colPaid}3" s="2"/><c r="\${colRef}3" s="2"/><c r="\${colEarly}3" s="2"/><c r="\${colLate}3" s="2"/><c r="\${colEve}3" s="2"/><c r="\${colH8}3" s="2"/><c r="\${colRemarks}3" s="2"/>
    </row>\`;

        // スタッフ行 (row 4〜: 行高 ht="24.75")
        validStaffIndices.forEach((s, idx) => {
            const staff = staffList[s];
            const r = 4 + idx;
            const rng = \`\${firstDayCol}\${r}:\${lastDayCol}\${r}\`;

            sheet1 += \`\\n    <row r="\${r}" ht="24.75" customHeight="1">\`;
            sheet1 += \`\\n      <c r="A\${r}" s="5" t="inlineStr"><is><t>\${staff.name}</t></is></c>\`;

            for (let d = 0; d < numDays; d++) {
                const col = toColLetter(2 + d);
                const cell = (grid && grid[s] && grid[s][d]) ? grid[s][d] : { symbol: '', isFixed: false };
                let rawSym = cell.symbol || '';
                let sym = rawSym.replace(/[◦•･◯○●]/g, '〇');
                const sIdx = cell.isFixed ? 7 : 6;
                sheet1 += \`\\n      <c r="\${col}\${r}" s="\${sIdx}" t="inlineStr"><is><t>\${sym}</t></is></c>\`;
            }

            const fWork = makeWorkCountFormulaXml(rng);
            const fOff = \`COUNTIF(\${rng},&quot;休&quot;)+0.5*(COUNTIF(\${rng},&quot;○/休&quot;)+COUNTIF(\${rng},&quot;〇/休&quot;)+COUNTIF(\${rng},&quot;休/○&quot;)+COUNTIF(\${rng},&quot;休/〇&quot;))\`;
            const fPaid = \`COUNTIF(\${rng},&quot;有&quot;)+0.5*(COUNTIF(\${rng},&quot;○/有&quot;)+COUNTIF(\${rng},&quot;〇/有&quot;)+COUNTIF(\${rng},&quot;有/○&quot;)+COUNTIF(\${rng},&quot;有/〇&quot;))\`;
            const fRef = makeRefHolidayFormulaXml(rng);
            const fEarly = \`COUNTIF(\${rng},&quot;早&quot;)+COUNTIF(\${rng},&quot;ハヤ&quot;)\`;
            const fLate = \`COUNTIF(\${rng},&quot;遅&quot;)+COUNTIF(\${rng},&quot;オソ&quot;)\`;
            const fEve = \`COUNTIF(\${rng},&quot;E&quot;)+COUNTIF(\${rng},&quot;イブ&quot;)\`;
            const fH8 = \`COUNTIF(\${rng},&quot;8時&quot;)\`;

            sheet1 += \`\\n      <c r="\${colWork}\${r}" s="8"><f>\${fWork}</f><v>0</v></c>
      <c r="\${colOff}\${r}" s="8"><f>\${fOff}</f><v>0</v></c>
      <c r="\${colPaid}\${r}" s="8"><f>\${fPaid}</f><v>0</v></c>
      <c r="\${colRef}\${r}" s="8"><f>\${fRef}</f><v>0</v></c>
      <c r="\${colEarly}\${r}" s="8"><f>\${fEarly}</f><v>0</v></c>
      <c r="\${colLate}\${r}" s="8"><f>\${fLate}</f><v>0</v></c>
      <c r="\${colEve}\${r}" s="8"><f>\${fEve}</f><v>0</v></c>
      <c r="\${colH8}\${r}" s="8"><f>\${fH8}</f><v>0</v></c>
      <c r="\${colRemarks}\${r}" s="14" t="inlineStr"><is><t>\${staff.remarks || ''}</t></is></c>
    </row>\`;
        });

        // 集計フッター行
        const endRow = 3 + validStaffIndices.length;

        // 1. 出勤人数合計行
        const rWork = endRow + 1;
        sheet1 += \`\\n    <row r="\${rWork}" ht="28.5" customHeight="1">
      <c r="A\${rWork}" s="9" t="inlineStr"><is><t>出勤人数合計</t></is></c>\`;

        for (let d = 0; d < numDays; d++) {
            const col = toColLetter(2 + d);
            const rngCol = \`\${col}$4:\${col}$\${endRow}\`;
            const fColWork = makeWorkCountFormulaXml(rngCol);
            sheet1 += \`\\n      <c r="\${col}\${rWork}" s="9"><f>\${fColWork}</f><v>0</v></c>\`;
        }
        sheet1 += \`\\n      <c r="\${colWork}\${rWork}" s="9"><f>SUM(\${firstDayCol}\${rWork}:\${lastDayCol}\${rWork})</f><v>0</v></c>\`;
        sheet1 += \`\\n      <c r="\${colOff}\${rWork}" s="13"><f>SUM(\${colOff}$4:\${colOff}$\${endRow})</f><v>0</v></c>\`;
        sheet1 += \`\\n      <c r="\${colPaid}\${rWork}" s="13"><f>SUM(\${colPaid}$4:\${colPaid}$\${endRow})</f><v>0</v></c>\`;
        sheet1 += \`\\n      <c r="\${colRef}\${rWork}" s="13"><f>SUM(\${colRef}$4:\${colRef}$\${endRow})</f><v>0</v></c>\`;
        sheet1 += \`\\n      <c r="\${colEarly}\${rWork}" s="13"><f>SUM(\${colEarly}$4:\${colEarly}$\${endRow})</f><v>0</v></c>\`;
        sheet1 += \`\\n      <c r="\${colLate}\${rWork}" s="13"><f>SUM(\${colLate}$4:\${colLate}$\${endRow})</f><v>0</v></c>\`;
        sheet1 += \`\\n      <c r="\${colEve}\${rWork}" s="13"><f>SUM(\${colEve}$4:\${colEve}$\${endRow})</f><v>0</v></c>\`;
        sheet1 += \`\\n      <c r="\${colH8}\${rWork}" s="13"><f>SUM(\${colH8}$4:\${colH8}$\${endRow})</f><v>0</v></c>\`;
        sheet1 += \`\\n      <c r="\${colRemarks}\${rWork}" s="9" t="inlineStr"><is><t>-</t></is></c>\`;
        sheet1 += \`\\n    </row>\`;

        // 2. 実数合計行 (案B仕様: offset > 0 のみ減算)
        const rReal = endRow + 2;
        sheet1 += \`\\n    <row r="\${rReal}" ht="28.5" customHeight="1">
      <c r="A\${rReal}" s="9" t="inlineStr"><is><t>実数合計</t></is></c>\`;
        for (let d = 0; d < numDays; d++) {
            const col = toColLetter(2 + d);
            const offset = (dayOffsets && dayOffsets[d]) ? dayOffsets[d] : 0;
            const fReal = (offset > 0) ? \`\${col}\${rWork}-(\${offset})\` : \`\${col}\${rWork}\`;
            sheet1 += \`\\n      <c r="\${col}\${rReal}" s="9"><f>\${fReal}</f><v>0</v></c>\`;
        }
        sheet1 += \`\\n      <c r="\${colWork}\${rReal}" s="9"><f>SUM(\${firstDayCol}\${rReal}:\${lastDayCol}\${rReal})</f><v>0</v></c>\`;
        for (let c = 3 + numDays; c <= 10 + numDays; c++) {
            sheet1 += \`\\n      <c r="\${toColLetter(c)}\${rReal}" s="9" t="inlineStr"><is><t>-</t></is></c>\`;
        }
        sheet1 += \`\\n    </row>\`;

        // 特殊勤務集計ヘルパー行の生成関数
        function renderSpecialRow(rNum, label, sIdx, symList) {
            sheet1 += \`\\n    <row r="\${rNum}" ht="20" customHeight="1">
      <c r="A\${rNum}" s="\${sIdx}" t="inlineStr"><is><t>\${label}</t></is></c>\`;
            for (let d = 0; d < numDays; d++) {
                const col = toColLetter(2 + d);
                const rngCol = \`\${col}$4:\${col}$\${endRow}\`;
                const formula = symList.map(sym => \`COUNTIF(\${rngCol},&quot;\${sym}&quot;)\`).join('+');
                sheet1 += \`\\n      <c r="\${col}\${rNum}" s="\${sIdx}"><f>\${formula}</f><v>0</v></c>\`;
            }
            sheet1 += \`\\n      <c r="\${colWork}\${rNum}" s="\${sIdx}"><f>SUM(\${firstDayCol}\${rNum}:\${lastDayCol}\${rNum})</f><v>0</v></c>\`;
            for (let c = 3 + numDays; c <= 10 + numDays; c++) {
                sheet1 += \`\\n      <c r="\${toColLetter(c)}\${rNum}" s="\${sIdx}" t="inlineStr"><is><t>-</t></is></c>\`;
            }
            sheet1 += \`\\n    </row>\`;
        }

        renderSpecialRow(endRow + 3, '早番 (早/ハヤ)', 10, ['早', 'ハヤ']);
        renderSpecialRow(endRow + 4, '遅番 (遅/オソ)', 11, ['遅', 'オソ']);
        renderSpecialRow(endRow + 5, 'イブニング (E/イブ)', 12, ['E', 'イブ']);
        renderSpecialRow(endRow + 6, '8:00 (8時)', 13, ['8時']);

        // 専従人数
        const rFull = endRow + 7;
        sheet1 += \`\\n    <row r="\${rFull}" ht="20" customHeight="1">
      <c r="A\${rFull}" s="9" t="inlineStr"><is><t>専従</t></is></c>\`;
        for (let d = 0; d < numDays; d++) {
            const col = toColLetter(2 + d);
            const terms = validStaffIndices.filter(s => staffList[s].isFullTime).map(s => {
                const r = 4 + validStaffIndices.indexOf(s);
                return \`IF(OR(\${col}\${r}=&quot;休&quot;,\${col}\${r}=&quot;有&quot;,\${col}\${r}=&quot;出&quot;,\${col}\${r}=&quot;上1&quot;,\${col}\${r}=&quot;上2&quot;,\${col}\${r}=&quot;上3&quot;,\${col}\${r}=&quot;上4&quot;,\${col}\${r}=&quot;上5&quot;,\${col}\${r}=&quot;下1&quot;,\${col}\${r}=&quot;下2&quot;,\${col}\${r}=&quot;下3&quot;,\${col}\${r}=&quot;ー&quot;),0,1)\`;
            });
            const f = terms.length > 0 ? terms.join('+') : '0';
            sheet1 += \`\\n      <c r="\${col}\${rFull}" s="9"><f>\${f}</f><v>0</v></c>\`;
        }
        sheet1 += \`\\n      <c r="\${colWork}\${rFull}" s="9" t="inlineStr"><is><t>-</t></is></c>\`;
        for (let c = 3 + numDays; c <= 10 + numDays; c++) {
            sheet1 += \`\\n      <c r="\${toColLetter(c)}\${rFull}" s="9" t="inlineStr"><is><t>-</t></is></c>\`;
        }
        sheet1 += \`\\n    </row>\`;

        sheet1 += \`\\n  </sheetData>
  <pageMargins left="0.2" right="0.2" top="0.3" bottom="0.3" header="0.1" footer="0.1"/>
  <pageSetup paperSize="8" orientation="landscape" fitToWidth="1" fitToHeight="1"/>
</worksheet>\`;

        const files = [
            { name: '[Content_Types].xml', data: contentTypes },
            { name: '_rels/.rels', data: rels },
            { name: 'xl/workbook.xml', data: workbook },
            { name: 'xl/_rels/workbook.xml.rels', data: wbRels },
            { name: 'xl/styles.xml', data: styles },
            { name: 'xl/worksheets/sheet1.xml', data: sheet1 }
        ];

        const zipBuf = createZipUint8Array(files);
        const blob = new Blob([zipBuf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', \`\${safeTitle.replace(/\\s+/g, '')}.xlsx\`);
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
            if (document.body.contains(link)) document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 2000);
        showToast('📊 本物のExcelファイル（.xlsx）をダウンロードしました！（A3横・1ページ印刷設定・動的数式・赤字太字付き）');
    }`;

code = code.substring(0, fnStart) + newFn + code.substring(nextFn);
fs.writeFileSync(appPath, code, 'utf8');
console.log('SUCCESS: exportExcelSpreadsheet is now completely dynamic for 28/29 days!');
