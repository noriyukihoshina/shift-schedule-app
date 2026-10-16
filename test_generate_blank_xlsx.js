// test_generate_blank_xlsx.js
// 空白勤務表を生成して実機Excelで開通テストを行う

const fs = require('fs');
const path = require('path');

// CRC32 テーブル & ZIP
const zipCrcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
        c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    }
    zipCrcTable[n] = c;
}
function calcZipCrc32(buf) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
        crc = (crc >>> 8) ^ zipCrcTable[(crc ^ buf[i]) & 0xFF];
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}
function createZipUint8Array(files) {
    const textEncoder = new TextEncoder();
    const fileEntries = files.map(f => {
        const nameBytes = textEncoder.encode(f.name);
        const dataBytes = (typeof f.data === 'string') ? textEncoder.encode(f.data) : f.data;
        return {
            name: f.name,
            nameBytes,
            dataBytes,
            crc: calcZipCrc32(dataBytes),
            size: dataBytes.length
        };
    });

    let localHeadersSize = 0;
    fileEntries.forEach(f => {
        f.offset = localHeadersSize;
        localHeadersSize += 30 + f.nameBytes.length + f.size;
    });

    let centralDirSize = 0;
    fileEntries.forEach(f => {
        centralDirSize += 46 + f.nameBytes.length;
    });

    const totalSize = localHeadersSize + centralDirSize + 22;
    const buf = new Uint8Array(totalSize);
    const view = new DataView(buf.buffer);
    let pos = 0;

    fileEntries.forEach(f => {
        view.setUint32(pos, 0x04034b50, true); pos += 4;
        view.setUint16(pos, 20, true); pos += 2;
        view.setUint16(pos, 0x0800, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint16(pos, 0x4a21, true); pos += 2;
        view.setUint16(pos, 0x5894, true); pos += 2;
        view.setUint32(pos, f.crc, true); pos += 4;
        view.setUint32(pos, f.size, true); pos += 4;
        view.setUint32(pos, f.size, true); pos += 4;
        view.setUint16(pos, f.nameBytes.length, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        buf.set(f.nameBytes, pos); pos += f.nameBytes.length;
        buf.set(f.dataBytes, pos); pos += f.size;
    });

    const cdOffset = pos;
    fileEntries.forEach(f => {
        view.setUint32(pos, 0x02014b50, true); pos += 4;
        view.setUint16(pos, 20, true); pos += 2;
        view.setUint16(pos, 20, true); pos += 2;
        view.setUint16(pos, 0x0800, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint16(pos, 0x4a21, true); pos += 2;
        view.setUint16(pos, 0x5894, true); pos += 2;
        view.setUint32(pos, f.crc, true); pos += 4;
        view.setUint32(pos, f.size, true); pos += 4;
        view.setUint32(pos, f.size, true); pos += 4;
        view.setUint16(pos, f.nameBytes.length, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint32(pos, 0, true); pos += 4;
        view.setUint32(pos, f.offset, true); pos += 4;
        buf.set(f.nameBytes, pos); pos += f.nameBytes.length;
    });

    view.setUint32(pos, 0x06054b50, true); pos += 4;
    view.setUint16(pos, 0, true); pos += 2;
    view.setUint16(pos, 0, true); pos += 2;
    view.setUint16(pos, fileEntries.length, true); pos += 2;
    view.setUint16(pos, fileEntries.length, true); pos += 2;
    view.setUint32(pos, centralDirSize, true); pos += 4;
    view.setUint32(pos, cdOffset, true); pos += 4;
    view.setUint16(pos, 0, true); pos += 2;

    return buf;
}

function toColLetter(colIdx) {
    let temp = colIdx;
    let letter = '';
    while (temp > 0) {
        let rem = (temp - 1) % 26;
        letter = String.fromCharCode(65 + rem) + letter;
        temp = Math.floor((temp - 1) / 26);
    }
    return letter;
}

function generateBlankXlsx() {
    const title = '4月1日～4月28日 スタッフ希望勤務入力シート';
    const NUM_DAYS = 28;

    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

    const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="希望入力シート" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

    const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
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
</styleSheet>`;

    let sheet1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView tabSelected="1" workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>
    <col min="1" max="1" width="5" customWidth="1"/>
    <col min="2" max="2" width="16" customWidth="1"/>
    <col min="3" max="30" width="6" customWidth="1"/>
    <col min="31" max="32" width="11" customWidth="1"/>
    <col min="33" max="33" width="162" customWidth="1"/>
  </cols>
  <sheetData>
    <row r="1" ht="24" customHeight="1">
      <c r="A1" s="1" t="inlineStr"><is><t>${title}</t></is></c>
    </row>
    <row r="2" ht="22" customHeight="1">
      <c r="A2" s="2" t="inlineStr"><is><t>No</t></is></c>
      <c r="B2" s="2" t="inlineStr"><is><t>氏名</t></is></c>`;

    for (let d = 0; d < NUM_DAYS; d++) {
        const colLetter = toColLetter(3 + d);
        sheet1 += `\n      <c r="${colLetter}2" s="2" t="inlineStr"><is><t>4/${d + 1}</t></is></c>`;
    }
    sheet1 += `\n      <c r="AE2" s="2" t="inlineStr"><is><t>希望休数</t></is></c>`;
    sheet1 += `\n      <c r="AF2" s="2" t="inlineStr"><is><t>希望有休数</t></is></c>`;
    sheet1 += `\n      <c r="AG2" s="2" t="inlineStr"><is><t>備考</t></is></c>`;
    sheet1 += `\n    </row>`;

    sheet1 += `\n    <row r="3" ht="20" customHeight="1">
      <c r="A3" s="2"/>
      <c r="B3" s="2"/>`;
    for (let d = 0; d < NUM_DAYS; d++) {
        const colLetter = toColLetter(3 + d);
        sheet1 += `\n      <c r="${colLetter}3" s="2" t="inlineStr"><is><t>月</t></is></c>`;
    }
    sheet1 += `\n      <c r="AE3" s="2"/>
      <c r="AF3" s="2"/>
      <c r="AG3" s="2"/>
    </row>`;

    const maxRow = 3 + 10;
    for (let idx = 0; idx < 10; idx++) {
        const r = idx + 4;
        sheet1 += `\n    <row r="${r}" ht="20" customHeight="1">`;
        sheet1 += `\n      <c r="A${r}" s="5"><v>${idx + 1}</v></c>`;
        sheet1 += `\n      <c r="B${r}" s="6" t="inlineStr"><is><t>スタッフ ${idx + 1}</t></is></c>`;
        for (let d = 0; d < NUM_DAYS; d++) {
            const colLetter = toColLetter(3 + d);
            sheet1 += `\n      <c r="${colLetter}${r}" s="5"/>`;
        }
        const fOff = `COUNTIF(C${r}:AD${r},&quot;休&quot;)+0.5*(COUNTIF(C${r}:AD${r},&quot;○/休&quot;)+COUNTIF(C${r}:AD${r},&quot;〇/休&quot;)+COUNTIF(C${r}:AD${r},&quot;休/○&quot;)+COUNTIF(C${r}:AD${r},&quot;休/〇&quot;))`;
        const fPaid = `COUNTIF(C${r}:AD${r},&quot;有&quot;)+0.5*(COUNTIF(C${r}:AD${r},&quot;○/有&quot;)+COUNTIF(C${r}:AD${r},&quot;〇/有&quot;)+COUNTIF(C${r}:AD${r},&quot;有/○&quot;)+COUNTIF(C${r}:AD${r},&quot;有/〇&quot;))`;
        sheet1 += `\n      <c r="AE${r}" s="7"><f>${fOff}</f><v>0</v></c>`;
        sheet1 += `\n      <c r="AF${r}" s="7"><f>${fPaid}</f><v>0</v></c>`;
        sheet1 += `\n      <c r="AG${r}" s="5"/>`;
        sheet1 += `\n    </row>`;
    }

    sheet1 += `\n  </sheetData>`;
    sheet1 += `\n  <dataValidations count="1">
    <dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" sqref="C4:AD${maxRow}" promptTitle="希望勤務の選択" prompt="プルダウンから希望勤務記号を選択してください。" errorTitle="入力値エラー" error="一覧（プルダウン）にある記号のみ入力できます。">
      <formula1>&quot;休,有,○,出,早,遅,E,8時,ハヤ,オソ,イブ,○/休,休/○,○/有,有/○,上1,上2,上3,上4,上5,下1,下2,下3&quot;</formula1>
    </dataValidation>
  </dataValidations>`;
    sheet1 += `\n  <pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>\n</worksheet>`;

    const files = [
        { name: '[Content_Types].xml', data: contentTypes },
        { name: '_rels/.rels', data: rels },
        { name: 'xl/workbook.xml', data: workbook },
        { name: 'xl/_rels/workbook.xml.rels', data: wbRels },
        { name: 'xl/styles.xml', data: styles },
        { name: 'xl/worksheets/sheet1.xml', data: sheet1 }
    ];

    return createZipUint8Array(files);
}

const buf = generateBlankXlsx();
fs.writeFileSync(path.join(__dirname, 'test_blank_output.xlsx'), buf);
console.log('Successfully generated test_blank_output.xlsx, size:', buf.length);
