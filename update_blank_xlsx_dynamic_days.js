// update_blank_xlsx_dynamic_days.js
const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, 'app.js');
let code = fs.readFileSync(appPath, 'utf8');

const fnStart = code.indexOf('function downloadBlankXlsx()');
const nextFn = code.indexOf('\n    function normalizeSymbol', fnStart);
const oldFn = code.substring(fnStart, nextFn);

const newFn = `function downloadBlankXlsx() {
        const term = getTermInfo();
        const numDays = term.dates.length;
        const title = \`\${term.first.m}月\${term.first.day}日～\${term.last.m}月\${term.last.day}日 スタッフ希望勤務入力シート（希望勤務はプルダウンから選択してください）\`;

        const lastDayCol = toColLetter(2 + numDays); // 28日: AD(列30), 29日: AE(列31)
        const colOff = toColLetter(3 + numDays);    // 28日: AE(列31), 29日: AF(列32)
        const colPaid = toColLetter(4 + numDays);   // 28日: AF(列32), 29日: AG(列33)
        const colRemarks = toColLetter(5 + numDays);// 28日: AG(列33), 29日: AH(列34)

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
    <sheet name="希望入力シート" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>\`;

        const wbRels = \`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>\`;

        const styles = \`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="4">
    <font><sz val="11"/><name val="游ゴシック"/></font>
    <font><b/><sz val="11"/><name val="游ゴシック"/></font>
    <font><b/><sz val="12"/><name val="游ゴシック"/><color rgb="1E293B"/></font>
    <font><b/><sz val="11"/><name val="游ゴシック"/><color rgb="DC2626"/></font>
  </fonts>
  <fills count="6">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="F1F5F9"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="EFF6FF"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FEF2F2"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="F0FDF4"/></patternFill></fill>
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
  <cellXfs count="8">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="4" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="5" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
  </cellXfs>
</styleSheet>\`;

        // sheet1.xml の組み立て
        let sheet1 = \`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView tabSelected="1" workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>
    <col min="1" max="1" width="5" customWidth="1"/>
    <col min="2" max="2" width="16" customWidth="1"/>
    <col min="3" max="\${2 + numDays}" width="6" customWidth="1"/>
    <col min="\${3 + numDays}" max="\${4 + numDays}" width="11" customWidth="1"/>
    <col min="\${5 + numDays}" max="\${5 + numDays}" width="162" customWidth="1"/>
  </cols>
  <sheetData>
    <row r="1" ht="24" customHeight="1">
      <c r="A1" s="1" t="inlineStr"><is><t>\${title}</t></is></c>
    </row>
    <row r="2" ht="22" customHeight="1">
      <c r="A2" s="2" t="inlineStr"><is><t>No</t></is></c>
      <c r="B2" s="2" t="inlineStr"><is><t>氏名</t></is></c>\`;

        // 日付ヘッダー (C2〜)
        for (let d = 0; d < numDays; d++) {
            const di = term.dates[d];
            const colLetter = toColLetter(3 + d);
            const dateStr = \`\${di.m}/\${di.day}\`;
            sheet1 += \`\\n      <c r="\${colLetter}2" s="2" t="inlineStr"><is><t>\${dateStr}</t></is></c>\`;
        }
        sheet1 += \`\\n      <c r="\${colOff}2" s="2" t="inlineStr"><is><t>希望休数</t></is></c>\`;
        sheet1 += \`\\n      <c r="\${colPaid}2" s="2" t="inlineStr"><is><t>希望有休数</t></is></c>\`;
        sheet1 += \`\\n      <c r="\${colRemarks}2" s="2" t="inlineStr"><is><t>備考</t></is></c>\`;
        sheet1 += \`\\n    </row>\`;

        // 3行目: 曜日ヘッダー行
        sheet1 += \`\\n    <row r="3" ht="20" customHeight="1">
      <c r="A3" s="2"/>
      <c r="B3" s="2"/>\`;
        for (let d = 0; d < numDays; d++) {
            const di = term.dates[d];
            const colLetter = toColLetter(3 + d);
            let sIdx = 2; // 平日
            if (di.weekday === '土' || di.wIdx === 5) sIdx = 3;
            else if (di.weekday === '日' || di.wIdx === 6 || di.isHoliday) sIdx = 4;
            sheet1 += \`\\n      <c r="\${colLetter}3" s="\${sIdx}" t="inlineStr"><is><t>\${di.weekday || di.w}</t></is></c>\`;
        }
        sheet1 += \`\\n      <c r="\${colOff}3" s="2"/>
      <c r="\${colPaid}3" s="2"/>
      <c r="\${colRemarks}3" s="2"/>
    </row>\`;

        // 有効スタッフのみ抽出
        const validStaff = staffList.filter(s => !s.isUnused);
        const maxRow = 3 + validStaff.length;

        // データ行（row 4〜: 希望枠は完全空欄）
        validStaff.forEach((staff, idx) => {
            const r = idx + 4;
            sheet1 += \`\\n    <row r="\${r}" ht="20" customHeight="1">
      <c r="A\${r}" s="5"><v>\${idx + 1}</v></c>
      <c r="B\${r}" s="6" t="inlineStr"><is><t>\${staff.name}</t></is></c>\`;

            for (let d = 0; d < numDays; d++) {
                const colLetter = toColLetter(3 + d);
                sheet1 += \`\\n      <c r="\${colLetter}\${r}" s="5"/>\`;
            }

            const rng = \`C\${r}:\${lastDayCol}\${r}\`;
            const fOff = \`COUNTIF(\${rng},&quot;休&quot;)+0.5*(COUNTIF(\${rng},&quot;○/休&quot;)+COUNTIF(\${rng},&quot;〇/休&quot;)+COUNTIF(\${rng},&quot;休/○&quot;)+COUNTIF(\${rng},&quot;休/〇&quot;))\`;
            const fPaid = \`COUNTIF(\${rng},&quot;有&quot;)+0.5*(COUNTIF(\${rng},&quot;○/有&quot;)+COUNTIF(\${rng},&quot;〇/有&quot;)+COUNTIF(\${rng},&quot;有/○&quot;)+COUNTIF(\${rng},&quot;有/〇&quot;))\`;
            sheet1 += \`\\n      <c r="\${colOff}\${r}" s="7"><f>\${fOff}</f><v>0</v></c>
      <c r="\${colPaid}\${r}" s="7"><f>\${fPaid}</f><v>0</v></c>
      <c r="\${colRemarks}\${r}" s="5"/>
    </row>\`;
        });

        sheet1 += \`\\n  </sheetData>\`;

        // ドロップダウンリスト（プルダウンデータ入力規則）を C4:{lastDayCol}{maxRow} に適用
        sheet1 += \`\\n  <dataValidations count="1">
    <dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" sqref="C4:\${lastDayCol}\${maxRow}" promptTitle="希望勤務の選択" prompt="プルダウンから希望勤務記号を選択してください。" errorTitle="入力値エラー" error="一覧（プルダウン）にある記号のみ入力できます。">
      <formula1>&quot;休,有,○,出,早,遅,E,8時,ハヤ,オソ,イブ,○/休,休/○,○/有,有/○,上1,上2,上3,上4,上5,下1,下2,下3,ー&quot;</formula1>
    </dataValidation>
  </dataValidations>\`;
        sheet1 += \`\\n  <pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>\\n</worksheet>\`;

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
        link.setAttribute('download', \`\${title.split('（')[0].replace(/\\s+/g, '')}.xlsx\`);
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
            if (document.body.contains(link)) document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 2000);
        showToast('📄 スタッフ配布用の空白勤務表（.xlsx）をダウンロードしました！');
    }`;

code = code.substring(0, fnStart) + newFn + code.substring(nextFn);
fs.writeFileSync(appPath, code, 'utf8');
console.log('SUCCESS: downloadBlankXlsx is now completely dynamic for 28/29 days!');
