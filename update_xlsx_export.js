const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, 'app.js');
let appJs = fs.readFileSync(appJsPath, 'utf8');

// 新しい exportExcelSpreadsheet 関数（本物の .xlsx 生成）
const newExportCode = `    function exportExcelSpreadsheet(grid, stats) {
        const term = getTermInfo();
        const title = \`\${term.title}（作成日: \${new Date().toLocaleDateString('ja-JP')}）\`;

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
    <sheet name="\${term.title.substring(0, 31)}" sheetId="1" r:id="rId1"/>
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
    <font><sz val="9"/><name val="Meiryo"/><color rgb="000000"/></font> <!-- 0: 通常 -->
    <font><b/><sz val="9"/><name val="Meiryo"/><color rgb="000000"/></font> <!-- 1: 太字黒 -->
    <font><b/><sz val="9"/><name val="Meiryo"/><color rgb="DC2626"/></font> <!-- 2: 🔒赤字太字 -->
    <font><b/><sz val="12"/><name val="Meiryo"/><color rgb="1E293B"/></font> <!-- 3: タイトル -->
    <font><b/><sz val="9"/><name val="Meiryo"/><color rgb="EA580C"/></font> <!-- 4: オレンジ(PT/OT A) -->
    <font><b/><sz val="9"/><name val="Meiryo"/><color rgb="1D4ED8"/></font> <!-- 5: 青(PT/OT B) -->
    <font><b/><sz val="9"/><name val="Meiryo"/><color rgb="EC4899"/></font> <!-- 6: 薄いピンク(ST) -->
    <font><b/><sz val="9"/><name val="Meiryo"/><color rgb="334155"/></font> <!-- 7: 濃い灰色(早〜8時) -->
    <font><b/><sz val="9"/><name val="Meiryo"/><color rgb="0284C7"/></font> <!-- 8: 土曜青 -->
    <font><b/><sz val="9"/><name val="Meiryo"/><color rgb="E11D48"/></font> <!-- 9: 日祝赤 -->
  </fonts>
  <fills count="6">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="F1F5F9"/></patternFill></fill> <!-- 2: ヘッダーグレー -->
    <fill><patternFill patternType="solid"><fgColor rgb="E0F2FE"/></patternFill></fill> <!-- 3: 土曜薄青 -->
    <fill><patternFill patternType="solid"><fgColor rgb="FFE4E6"/></patternFill></fill> <!-- 4: 日祝薄赤 -->
    <fill><patternFill patternType="solid"><fgColor rgb="F8FAFC"/></patternFill></fill> <!-- 5: 合計薄グレー -->
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/></border>
    <border>
      <left style="thin"><color rgb="CBD5E1"/></left>
      <right style="thin"><color rgb="CBD5E1"/></right>
      <top style="thin"><color rgb="CBD5E1"/></top>
      <bottom style="thin"><color rgb="CBD5E1"/></bottom>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="15">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/> <!-- 0: default -->
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0"><alignment horizontal="left" vertical="center"/></xf> <!-- 1: title -->
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf> <!-- 2: header gray -->
    <xf numFmtId="0" fontId="8" fillId="3" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf> <!-- 3: header sat -->
    <xf numFmtId="0" fontId="9" fillId="4" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf> <!-- 4: header sun -->
    <xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0"><alignment horizontal="left" vertical="center"/></xf> <!-- 5: staff name -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf> <!-- 6: normal symbol -->
    <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf> <!-- 7: 🔒fixed symbol red -->
    <xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf> <!-- 8: staff stat black -->
    <xf numFmtId="0" fontId="1" fillId="5" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf> <!-- 9: total sum / real sum -->
    <xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf> <!-- 10: PT/OT A orange -->
    <xf numFmtId="0" fontId="5" fillId="0" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf> <!-- 11: PT/OT B blue -->
    <xf numFmtId="0" fontId="6" fillId="0" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf> <!-- 12: ST pink -->
    <xf numFmtId="0" fontId="7" fillId="0" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf> <!-- 13: early/late/eve/h8 gray -->
    <xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf> <!-- 14: footer label center -->
  </cellXfs>
</styleSheet>\`;

        const validStaffIndices = [];
        for (let s = 0; s < staffList.length; s++) {
            if (!staffList[s].isUnused) validStaffIndices.push(s);
        }
        const endRow = 3 + validStaffIndices.length;

        // セクション行範囲計算
        let ptAStart = 4, ptAEnd = 4;
        let otAStart = 4, otAEnd = 4;
        let ptBStart = 4, ptBEnd = 4;
        let otBStart = 4, otBEnd = 4;
        const stStartRow = 55;

        validStaffIndices.forEach((s, idx) => {
            const staff = staffList[s];
            const row = 4 + idx;
            if (staff.section === 'PT A') { if (ptAStart === 4 && idx !== 0) ptAStart = row; ptAEnd = row; }
            if (staff.section === 'OT A') { if (otAStart === 4) otAStart = row; otAEnd = row; }
            if (staff.section === 'PT B') { if (ptBStart === 4) ptBStart = row; ptBEnd = row; }
            if (staff.section === 'OT B') { if (otBStart === 4) otBStart = row; otBEnd = row; }
        });

        function makeWorkCountFormulaXml(range) {
            const symbols = ['○', '〇', '出', '早', '遅', 'E', '8時', 'ハヤ', 'オソ', 'イブ'];
            return \`SUM(\${symbols.map(s => \`COUNTIF(\${range},&quot;\${s}&quot;)\`).join(',')})\`;
        }

        let sheet1 = \`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr>
    <pageSetUpPr fitToPage="1"/>
  </sheetPr>
  <sheetViews><sheetView tabSelected="1" workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>
    <col min="1" max="1" width="16" customWidth="1"/> <!-- A: 氏名 (約115px、A3縦横比最適化) -->
    <col min="2" max="29" width="4.8" customWidth="1"/> <!-- B〜AC: 28日分 -->
    <col min="30" max="33" width="7" customWidth="1"/> <!-- AD〜AG: 出勤, 公休, 有休, リフ (黒字) -->
    <col min="34" max="37" width="5.5" customWidth="1"/> <!-- AH〜AK: 早, 遅, E, 8時 -->
  </cols>
  <sheetData>
    <!-- 1行目: タイトル -->
    <row r="1" ht="24" customHeight="1">
      <c r="A1" s="1" t="inlineStr"><is><t>\${title}</t></is></c>
    </row>
    <!-- 2行目: 日付ヘッダー行 -->
    <row r="2" ht="20" customHeight="1">
      <c r="A2" s="2" t="inlineStr"><is><t>氏名</t></is></c>\`;

        for (let d = 0; d < NUM_DAYS; d++) {
            const di = term.dates[d];
            const col = toColLetter(2 + d);
            sheet1 += \`\\n      <c r="\${col}2" s="2" t="inlineStr"><is><t>\${di.label}</t></is></c>\`;
        }
        sheet1 += \`\\n      <c r="AD2" s="2" t="inlineStr"><is><t>出勤</t></is></c>
      <c r="AE2" s="2" t="inlineStr"><is><t>公休</t></is></c>
      <c r="AF2" s="2" t="inlineStr"><is><t>有休</t></is></c>
      <c r="AG2" s="2" t="inlineStr"><is><t>リフ</t></is></c>
      <c r="AH2" s="2" t="inlineStr"><is><t>早</t></is></c>
      <c r="AI2" s="2" t="inlineStr"><is><t>遅</t></is></c>
      <c r="AJ2" s="2" t="inlineStr"><is><t>E</t></is></c>
      <c r="AK2" s="2" t="inlineStr"><is><t>8時</t></is></c>
    </row>\`;

        // 3行目: 曜日ヘッダー行
        sheet1 += \`\\n    <row r="3" ht="18" customHeight="1">
      <c r="A3" s="2"/>\`;
        for (let d = 0; d < NUM_DAYS; d++) {
            const di = term.dates[d];
            const col = toColLetter(2 + d);
            let sIdx = 2;
            if (di.wIdx === 5) sIdx = 3; // 土曜青
            else if (di.wIdx === 6 || di.isHoliday) sIdx = 4; // 日祝赤
            sheet1 += \`\\n      <c r="\${col}3" s="\${sIdx}" t="inlineStr"><is><t>\${di.weekday}</t></is></c>\`;
        }
        sheet1 += \`\\n      <c r="AD3" s="2"/><c r="AE3" s="2"/><c r="AF3" s="2"/><c r="AG3" s="2"/><c r="AH3" s="2"/><c r="AI3" s="2"/><c r="AJ3" s="2"/><c r="AK3" s="2"/>
    </row>\`;

        // スタッフ行 (row 4〜)
        validStaffIndices.forEach((s, idx) => {
            const staff = staffList[s];
            const r = 4 + idx;
            const rng = \`B\${r}:AC\${r}\`;

            sheet1 += \`\\n    <row r="\${r}" ht="20" customHeight="1">\`;
            sheet1 += \`\\n      <c r="A\${r}" s="5" t="inlineStr"><is><t>\${staff.name}</t></is></c>\`;

            for (let d = 0; d < NUM_DAYS; d++) {
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
            const fRef = \`COUNTIF(\${rng},&quot;上1&quot;)+COUNTIF(\${rng},&quot;上2&quot;)+COUNTIF(\${rng},&quot;上3&quot;)+COUNTIF(\${rng},&quot;上4&quot;)+COUNTIF(\${rng},&quot;上5&quot;)+COUNTIF(\${rng},&quot;下1&quot;)+COUNTIF(\${rng},&quot;下2&quot;)+COUNTIF(\${rng},&quot;下3&quot;))\`;
            const fEarly = \`COUNTIF(\${rng},&quot;早&quot;)+COUNTIF(\${rng},&quot;ハヤ&quot;)\`;
            const fLate = \`COUNTIF(\${rng},&quot;遅&quot;)+COUNTIF(\${rng},&quot;オソ&quot;)\`;
            const fEve = \`COUNTIF(\${rng},&quot;E&quot;)+COUNTIF(\${rng},&quot;イブ&quot;)\`;
            const fH8 = \`COUNTIF(\${rng},&quot;8時&quot;)\`;

            sheet1 += \`\\n      <c r="AD\${r}" s="8"><f>\${fWork}</f><v>0</v></c>\`;
            sheet1 += \`\\n      <c r="AE\${r}" s="8"><f>\${fOff}</f><v>0</v></c>\`;
            sheet1 += \`\\n      <c r="AF\${r}" s="8"><f>\${fPaid}</f><v>0</v></c>\`;
            sheet1 += \`\\n      <c r="AG\${r}" s="8"><f>\${fRef}</f><v>0</v></c>\`;
            sheet1 += \`\\n      <c r="AH\${r}" s="13"><f>\${fEarly}</f><v>0</v></c>\`;
            sheet1 += \`\\n      <c r="AI\${r}" s="13"><f>\${fLate}</f><v>0</v></c>\`;
            sheet1 += \`\\n      <c r="AJ\${r}" s="13"><f>\${fEve}</f><v>0</v></c>\`;
            sheet1 += \`\\n      <c r="AK\${r}" s="13"><f>\${fH8}</f><v>0</v></c>\`;
            sheet1 += \`\\n    </row>\`;
        });

        // 集計フッター行
        // 1. 出勤人数合計
        const rWork = endRow + 1;
        sheet1 += \`\\n    <row r="\${rWork}" ht="20" customHeight="1">
      <c r="A\${rWork}" s="9" t="inlineStr"><is><t>出勤人数合計</t></is></c>\`;
        for (let d = 0; d < NUM_DAYS; d++) {
            const col = toColLetter(2 + d);
            sheet1 += \`\\n      <c r="\${col}\${rWork}" s="9"><f>\${makeWorkCountFormulaXml(\`INDIRECT(&quot;\${col}$4:\${col}&quot;&amp;(ROW()-1))\`)}</f><v>0</v></c>\`;
        }
        sheet1 += \`\\n      <c r="AD\${rWork}" s="9"><f>SUM(INDIRECT(&quot;AD$4:AD&quot;&amp;(ROW()-1)))</f><v>0</v></c>\`;
        sheet1 += \`\\n      <c r="AE\${rWork}" s="9"><f>SUM(INDIRECT(&quot;AE$4:AE&quot;&amp;(ROW()-1)))</f><v>0</v></c>\`;
        sheet1 += \`\\n      <c r="AF\${rWork}" s="9"><f>SUM(INDIRECT(&quot;AF$4:AF&quot;&amp;(ROW()-1)))</f><v>0</v></c>\`;
        sheet1 += \`\\n      <c r="AG\${rWork}" s="9"><f>SUM(INDIRECT(&quot;AG$4:AG&quot;&amp;(ROW()-1)))</f><v>0</v></c>\`;
        sheet1 += \`\\n      <c r="AH\${rWork}" s="13"><f>SUM(INDIRECT(&quot;AH$4:AH&quot;&amp;(ROW()-1)))</f><v>0</v></c>\`;
        sheet1 += \`\\n      <c r="AI\${rWork}" s="13"><f>SUM(INDIRECT(&quot;AI$4:AI&quot;&amp;(ROW()-1)))</f><v>0</v></c>\`;
        sheet1 += \`\\n      <c r="AJ\${rWork}" s="13"><f>SUM(INDIRECT(&quot;AJ$4:AJ&quot;&amp;(ROW()-1)))</f><v>0</v></c>\`;
        sheet1 += \`\\n      <c r="AK\${rWork}" s="13"><f>SUM(INDIRECT(&quot;AK$4:AK&quot;&amp;(ROW()-1)))</f><v>0</v></c>\`;
        sheet1 += \`\\n    </row>\`;

        // 2. 実数合計
        const rReal = endRow + 2;
        sheet1 += \`\\n    <row r="\${rReal}" ht="20" customHeight="1">
      <c r="A\${rReal}" s="9" t="inlineStr"><is><t>実数合計</t></is></c>\`;
        for (let d = 0; d < NUM_DAYS; d++) {
            const col = toColLetter(2 + d);
            const offset = (dayOffsets && dayOffsets[d]) ? dayOffsets[d] : 0;
            const fReal = offset === 0 ? \`INDIRECT(&quot;\${col}&quot;&amp;(ROW()-1))\` : \`INDIRECT(&quot;\${col}&quot;&amp;(ROW()-1))-(\${offset})\`;
            sheet1 += \`\\n      <c r="\${col}\${rReal}" s="9"><f>\${fReal}</f><v>0</v></c>\`;
        }
        sheet1 += \`\\n      <c r="AD\${rReal}" s="9"><f>SUM(B\${rReal}:AC\${rReal})</f><v>0</v></c>\`;
        for (let c = 31; c <= 37; c++) {
            sheet1 += \`\\n      <c r="\${toColLetter(c)}\${rReal}" s="9" t="inlineStr"><is><t>-</t></is></c>\`;
        }
        sheet1 += \`\\n    </row>\`;

        // 3. PT A 出勤
        const rPtA = endRow + 3;
        sheet1 += \`\\n    <row r="\${rPtA}" ht="20" customHeight="1">
      <c r="A\${rPtA}" s="10" t="inlineStr"><is><t>PT A 出勤</t></is></c>\`;
        for (let d = 0; d < NUM_DAYS; d++) {
            const col = toColLetter(2 + d);
            sheet1 += \`\\n      <c r="\${col}\${rPtA}" s="10"><f>\${makeWorkCountFormulaXml(\`\${col}$\${ptAStart}:\${col}$\${ptAEnd}\`)}</f><v>0</v></c>\`;
        }
        sheet1 += \`\\n      <c r="AD\${rPtA}" s="10"><f>SUM(B\${rPtA}:AC\${rPtA})</f><v>0</v></c>\`;
        for (let c = 31; c <= 37; c++) sheet1 += \`\\n      <c r="\${toColLetter(c)}\${rPtA}" s="10" t="inlineStr"><is><t>-</t></is></c>\`;
        sheet1 += \`\\n    </row>\`;

        // 4. OT A 出勤
        const rOtA = endRow + 4;
        sheet1 += \`\\n    <row r="\${rOtA}" ht="20" customHeight="1">
      <c r="A\${rOtA}" s="10" t="inlineStr"><is><t>OT A 出勤</t></is></c>\`;
        for (let d = 0; d < NUM_DAYS; d++) {
            const col = toColLetter(2 + d);
            sheet1 += \`\\n      <c r="\${col}\${rOtA}" s="10"><f>\${makeWorkCountFormulaXml(\`\${col}$\${otAStart}:\${col}$\${otAEnd}\`)}</f><v>0</v></c>\`;
        }
        sheet1 += \`\\n      <c r="AD\${rOtA}" s="10"><f>SUM(B\${rOtA}:AC\${rOtA})</f><v>0</v></c>\`;
        for (let c = 31; c <= 37; c++) sheet1 += \`\\n      <c r="\${toColLetter(c)}\${rOtA}" s="10" t="inlineStr"><is><t>-</t></is></c>\`;
        sheet1 += \`\\n    </row>\`;

        // 5. PT B 出勤
        const rPtB = endRow + 5;
        sheet1 += \`\\n    <row r="\${rPtB}" ht="20" customHeight="1">
      <c r="A\${rPtB}" s="11" t="inlineStr"><is><t>PT B 出勤</t></is></c>\`;
        for (let d = 0; d < NUM_DAYS; d++) {
            const col = toColLetter(2 + d);
            sheet1 += \`\\n      <c r="\${col}\${rPtB}" s="11"><f>\${makeWorkCountFormulaXml(\`\${col}$\${ptBStart}:\${col}$\${ptBEnd}\`)}</f><v>0</v></c>\`;
        }
        sheet1 += \`\\n      <c r="AD\${rPtB}" s="11"><f>SUM(B\${rPtB}:AC\${rPtB})</f><v>0</v></c>\`;
        for (let c = 31; c <= 37; c++) sheet1 += \`\\n      <c r="\${toColLetter(c)}\${rPtB}" s="11" t="inlineStr"><is><t>-</t></is></c>\`;
        sheet1 += \`\\n    </row>\`;

        // 6. OT B 出勤
        const rOtB = endRow + 6;
        sheet1 += \`\\n    <row r="\${rOtB}" ht="20" customHeight="1">
      <c r="A\${rOtB}" s="11" t="inlineStr"><is><t>OT B 出勤</t></is></c>\`;
        for (let d = 0; d < NUM_DAYS; d++) {
            const col = toColLetter(2 + d);
            sheet1 += \`\\n      <c r="\${col}\${rOtB}" s="11"><f>\${makeWorkCountFormulaXml(\`\${col}$\${otBStart}:\${col}$\${otBEnd}\`)}</f><v>0</v></c>\`;
        }
        sheet1 += \`\\n      <c r="AD\${rOtB}" s="11"><f>SUM(B\${rOtB}:AC\${rOtB})</f><v>0</v></c>\`;
        for (let c = 31; c <= 37; c++) sheet1 += \`\\n      <c r="\${toColLetter(c)}\${rOtB}" s="11" t="inlineStr"><is><t>-</t></is></c>\`;
        sheet1 += \`\\n    </row>\`;

        // 7. ST 出勤
        const rSt = endRow + 7;
        sheet1 += \`\\n    <row r="\${rSt}" ht="20" customHeight="1">
      <c r="A\${rSt}" s="12" t="inlineStr"><is><t>ST 出勤</t></is></c>\`;
        for (let d = 0; d < NUM_DAYS; d++) {
            const col = toColLetter(2 + d);
            const fSt = \`IF((ROW()-7)&lt;\${stStartRow},0,\${makeWorkCountFormulaXml(\`INDIRECT(&quot;\${col}$\${stStartRow}:\${col}&quot;&amp;(ROW()-7))\`)} )\`;
            sheet1 += \`\\n      <c r="\${col}\${rSt}" s="12"><f>\${fSt}</f><v>0</v></c>\`;
        }
        sheet1 += \`\\n      <c r="AD\${rSt}" s="12"><f>SUM(B\${rSt}:AC\${rSt})</f><v>0</v></c>\`;
        for (let c = 31; c <= 37; c++) sheet1 += \`\\n      <c r="\${toColLetter(c)}\${rSt}" s="12" t="inlineStr"><is><t>-</t></is></c>\`;
        sheet1 += \`\\n    </row>\`;

        // 8. 早番
        const rEarly = endRow + 8;
        sheet1 += \`\\n    <row r="\${rEarly}" ht="20" customHeight="1">
      <c r="A\${rEarly}" s="13" t="inlineStr"><is><t>早番</t></is></c>\`;
        for (let d = 0; d < NUM_DAYS; d++) {
            const col = toColLetter(2 + d);
            sheet1 += \`\\n      <c r="\${col}\${rEarly}" s="13"><f>COUNTIF(INDIRECT(&quot;\${col}$4:\${col}&quot;&amp;(ROW()-8)),&quot;早&quot;)+COUNTIF(INDIRECT(&quot;\${col}$4:\${col}&quot;&amp;(ROW()-8)),&quot;ハヤ&quot;)</f><v>0</v></c>\`;
        }
        sheet1 += \`\\n      <c r="AD\${rEarly}" s="13"><f>SUM(B\${rEarly}:AC\${rEarly})</f><v>0</v></c>\`;
        for (let c = 31; c <= 37; c++) sheet1 += \`\\n      <c r="\${toColLetter(c)}\${rEarly}" s="13" t="inlineStr"><is><t>-</t></is></c>\`;
        sheet1 += \`\\n    </row>\`;

        // 9. 遅番
        const rLate = endRow + 9;
        sheet1 += \`\\n    <row r="\${rLate}" ht="20" customHeight="1">
      <c r="A\${rLate}" s="13" t="inlineStr"><is><t>遅番</t></is></c>\`;
        for (let d = 0; d < NUM_DAYS; d++) {
            const col = toColLetter(2 + d);
            sheet1 += \`\\n      <c r="\${col}\${rLate}" s="13"><f>COUNTIF(INDIRECT(&quot;\${col}$4:\${col}&quot;&amp;(ROW()-9)),&quot;遅&quot;)+COUNTIF(INDIRECT(&quot;\${col}$4:\${col}&quot;&amp;(ROW()-9)),&quot;オソ&quot;)</f><v>0</v></c>\`;
        }
        sheet1 += \`\\n      <c r="AD\${rLate}" s="13"><f>SUM(B\${rLate}:AC\${rLate})</f><v>0</v></c>\`;
        for (let c = 31; c <= 37; c++) sheet1 += \`\\n      <c r="\${toColLetter(c)}\${rLate}" s="13" t="inlineStr"><is><t>-</t></is></c>\`;
        sheet1 += \`\\n    </row>\`;

        // 10. E
        const rEve = endRow + 10;
        sheet1 += \`\\n    <row r="\${rEve}" ht="20" customHeight="1">
      <c r="A\${rEve}" s="13" t="inlineStr"><is><t>E</t></is></c>\`;
        for (let d = 0; d < NUM_DAYS; d++) {
            const col = toColLetter(2 + d);
            sheet1 += \`\\n      <c r="\${col}\${rEve}" s="13"><f>COUNTIF(INDIRECT(&quot;\${col}$4:\${col}&quot;&amp;(ROW()-10)),&quot;E&quot;)+COUNTIF(INDIRECT(&quot;\${col}$4:\${col}&quot;&amp;(ROW()-10)),&quot;イブ&quot;)</f><v>0</v></c>\`;
        }
        sheet1 += \`\\n      <c r="AD\${rEve}" s="13"><f>SUM(B\${rEve}:AC\${rEve})</f><v>0</v></c>\`;
        for (let c = 31; c <= 37; c++) sheet1 += \`\\n      <c r="\${toColLetter(c)}\${rEve}" s="13" t="inlineStr"><is><t>-</t></is></c>\`;
        sheet1 += \`\\n    </row>\`;

        // 11. 8時
        const rH8 = endRow + 11;
        sheet1 += \`\\n    <row r="\${rH8}" ht="20" customHeight="1">
      <c r="A\${rH8}" s="13" t="inlineStr"><is><t>8時</t></is></c>\`;
        for (let d = 0; d < NUM_DAYS; d++) {
            const col = toColLetter(2 + d);
            sheet1 += \`\\n      <c r="\${col}\${rH8}" s="13"><f>COUNTIF(INDIRECT(&quot;\${col}$4:\${col}&quot;&amp;(ROW()-11)),&quot;8時&quot;)</f><v>0</v></c>\`;
        }
        sheet1 += \`\\n      <c r="AD\${rH8}" s="13"><f>SUM(B\${rH8}:AC\${rH8})</f><v>0</v></c>\`;
        for (let c = 31; c <= 37; c++) sheet1 += \`\\n      <c r="\${toColLetter(c)}\${rH8}" s="13" t="inlineStr"><is><t>-</t></is></c>\`;
        sheet1 += \`\\n    </row>\`;

        sheet1 += \`\\n  </sheetData>
  <pageMargins left="0.25" right="0.25" top="0.3" bottom="0.3" header="0.2" footer="0.2"/>
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
        link.setAttribute('download', \`\${term.title}.xlsx\`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('📊 本物のExcelファイル（.xlsx）をダウンロードしました！（A3横・1ページ印刷設定・動的数式・赤字太字付き）');
    }`;

// app.js 内の exportExcelSpreadsheet 関数全体を置換
const regex = /function exportExcelSpreadsheet\(grid, stats\) \{[\s\S]*?showToast\('📊 Excelファイルをダウンロードしました！[\s\S]*?\n    \}/;

if (regex.test(appJs)) {
    appJs = appJs.replace(regex, newExportCode.trim());
    fs.writeFileSync(appJsPath, appJs, 'utf8');
    console.log('SUCCESS: Fully replaced exportExcelSpreadsheet with real .xlsx generator!');
} else {
    console.error('ERROR: Could not find exportExcelSpreadsheet function in app.js');
}
