
const fs = require('fs');

function calcZipCrc32(bytes) {
    let crc = 0xFFFFFFFF;
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        table[i] = c;
    }
    for (let i = 0; i < bytes.length; i++) crc = table[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function zipFiles(files) {
    const textEncoder = new TextEncoder();
    const fileEntries = files.map(f => {
        const nameBytes = textEncoder.encode(f.name);
        const dataBytes = (typeof f.data === 'string') ? textEncoder.encode(f.data) : (f.data instanceof Uint8Array ? f.data : Buffer.from(f.data));
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
  <sheets><sheet name="2026年4月勤務表" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;
const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

// 48名のスタッフデータでフル構成をテスト
const numStaff = 48;
const endRow = 3 + numStaff; // 51

function makeWorkCountFormulaXml(rng) {
    const symbols = ['○', '〇', '出', '早', '遅', 'E', '8時', 'ハヤ', 'オソ', 'イブ'];
    return `SUM(${symbols.map(s => `COUNTIF(${rng},&quot;${s}&quot;)`).join(',')})`;
}

let sheet1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <sheetViews><sheetView tabSelected="1" workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>
    <col min="1" max="1" width="16" customWidth="1"/>
    <col min="2" max="29" width="4.0" customWidth="1"/>
    <col min="30" max="33" width="7" customWidth="1"/>
    <col min="34" max="37" width="4.0" customWidth="1"/>
  </cols>
  <sheetData>
    <row r="1" ht="24"><c r="A1" s="1" t="inlineStr"><is><t>2026年4月勤務表</t></is></c></row>
    <row r="2" ht="20"><c r="A2" s="2" t="inlineStr"><is><t>氏名</t></is></c>`;

for (let d = 0; d < 28; d++) {
    sheet1 += `\n      <c r="${toColLetter(2+d)}2" s="2" t="inlineStr"><is><t>4/${d+1}</t></is></c>`;
}
sheet1 += `\n      <c r="AD2" s="2" t="inlineStr"><is><t>出勤</t></is></c>
      <c r="AE2" s="2" t="inlineStr"><is><t>公休</t></is></c>
      <c r="AF2" s="2" t="inlineStr"><is><t>有休</t></is></c>
      <c r="AG2" s="2" t="inlineStr"><is><t>リフ</t></is></c>
      <c r="AH2" s="2" t="inlineStr"><is><t>早</t></is></c>
      <c r="AI2" s="2" t="inlineStr"><is><t>遅</t></is></c>
      <c r="AJ2" s="2" t="inlineStr"><is><t>E</t></is></c>
      <c r="AK2" s="2" t="inlineStr"><is><t>8時</t></is></c>
    </row>
    <row r="3" ht="18"><c r="A3" s="2"/>`;
for (let d = 0; d < 28; d++) {
    sheet1 += `\n      <c r="${toColLetter(2+d)}3" s="2" t="inlineStr"><is><t>水</t></is></c>`;
}
sheet1 += `\n      <c r="AD3" s="2"/><c r="AE3" s="2"/><c r="AF3" s="2"/><c r="AG3" s="2"/><c r="AH3" s="2"/><c r="AI3" s="2"/><c r="AJ3" s="2"/><c r="AK3" s="2"/>
    </row>`;

// スタッフ48名 (row 4〜51)
for (let i = 1; i <= numStaff; i++) {
    const r = 3 + i;
    const rng = `B${r}:AC${r}`;
    sheet1 += `\n    <row r="${r}" ht="20">\n      <c r="A${r}" s="5" t="inlineStr"><is><t>スタッフ${i}</t></is></c>`;
    for (let d = 0; d < 28; d++) {
        sheet1 += `\n      <c r="${toColLetter(2+d)}${r}" s="6" t="inlineStr"><is><t>〇</t></is></c>`;
    }
    const fWork = makeWorkCountFormulaXml(rng);
    const fOff = `COUNTIF(${rng},&quot;休&quot;)+0.5*(COUNTIF(${rng},&quot;○/休&quot;)+COUNTIF(${rng},&quot;〇/休&quot;)+COUNTIF(${rng},&quot;休/○&quot;)+COUNTIF(${rng},&quot;休/〇&quot;))`;
    const fPaid = `COUNTIF(${rng},&quot;有&quot;)+0.5*(COUNTIF(${rng},&quot;○/有&quot;)+COUNTIF(${rng},&quot;〇/有&quot;)+COUNTIF(${rng},&quot;有/○&quot;)+COUNTIF(${rng},&quot;有/〇&quot;))`;
    const fRef = `COUNTIF(${rng},&quot;上1&quot;)+COUNTIF(${rng},&quot;上2&quot;)+COUNTIF(${rng},&quot;上3&quot;)+COUNTIF(${rng},&quot;上4&quot;)+COUNTIF(${rng},&quot;上5&quot;)+COUNTIF(${rng},&quot;下1&quot;)+COUNTIF(${rng},&quot;下2&quot;)+COUNTIF(${rng},&quot;下3&quot;)`; // ★ typo修正済み！
    const fEarly = `COUNTIF(${rng},&quot;早&quot;)+COUNTIF(${rng},&quot;ハヤ&quot;)`;
    const fLate = `COUNTIF(${rng},&quot;遅&quot;)+COUNTIF(${rng},&quot;オソ&quot;)`;
    const fEve = `COUNTIF(${rng},&quot;E&quot;)+COUNTIF(${rng},&quot;イブ&quot;)`;
    const fH8 = `COUNTIF(${rng},&quot;8時&quot;)`;

    sheet1 += `\n      <c r="AD${r}" s="8"><f>${fWork}</f><v>0</v></c>`;
    sheet1 += `\n      <c r="AE${r}" s="8"><f>${fOff}</f><v>0</v></c>`;
    sheet1 += `\n      <c r="AF${r}" s="8"><f>${fPaid}</f><v>0</v></c>`;
    sheet1 += `\n      <c r="AG${r}" s="8"><f>${fRef}</f><v>0</v></c>`;
    sheet1 += `\n      <c r="AH${r}" s="13"><f>${fEarly}</f><v>0</v></c>`;
    sheet1 += `\n      <c r="AI${r}" s="13"><f>${fLate}</f><v>0</v></c>`;
    sheet1 += `\n      <c r="AJ${r}" s="13"><f>${fEve}</f><v>0</v></c>`;
    sheet1 += `\n      <c r="AK${r}" s="13"><f>${fH8}</f><v>0</v></c>`;
    sheet1 += `\n    </row>`;
}

// 静的参照（STATIC）によるフッター行！
// 1. 出勤人数合計 (row 52)
const rWork = endRow + 1;
sheet1 += `\n    <row r="${rWork}" ht="20">\n      <c r="A${rWork}" s="9" t="inlineStr"><is><t>出勤人数合計</t></is></c>`;
for (let d = 0; d < 28; d++) {
    const col = toColLetter(2+d);
    // 静的参照: col$4:col$51 (INDIRECTなし！)
    sheet1 += `\n      <c r="${col}${rWork}" s="9"><f>${makeWorkCountFormulaXml(`${col}$4:${col}$${endRow}`)}</f><v>0</v></c>`;
}
sheet1 += `\n      <c r="AD${rWork}" s="9"><f>SUM(AD$4:AD${endRow})</f><v>0</v></c>`;
sheet1 += `\n      <c r="AE${rWork}" s="9"><f>SUM(AE$4:AE${endRow})</f><v>0</v></c>`;
sheet1 += `\n      <c r="AF${rWork}" s="9"><f>SUM(AF$4:AF${endRow})</f><v>0</v></c>`;
sheet1 += `\n      <c r="AG${rWork}" s="9"><f>SUM(AG$4:AG${endRow})</f><v>0</v></c>`;
sheet1 += `\n      <c r="AH${rWork}" s="13"><f>SUM(AH$4:AH${endRow})</f><v>0</v></c>`;
sheet1 += `\n      <c r="AI${rWork}" s="13"><f>SUM(AI$4:AI${endRow})</f><v>0</v></c>`;
sheet1 += `\n      <c r="AJ${rWork}" s="13"><f>SUM(AJ$4:AJ${endRow})</f><v>0</v></c>`;
sheet1 += `\n      <c r="AK${rWork}" s="13"><f>SUM(AK$4:AK${endRow})</f><v>0</v></c>`;
sheet1 += `\n    </row>`;

// 2. 実数合計 (row 53)
const rReal = endRow + 2;
sheet1 += `\n    <row r="${rReal}" ht="20">\n      <c r="A${rReal}" s="9" t="inlineStr"><is><t>実数合計</t></is></c>`;
for (let d = 0; d < 28; d++) {
    const col = toColLetter(2+d);
    sheet1 += `\n      <c r="${col}${rReal}" s="9"><f>${col}${rWork}</f><v>0</v></c>`;
}
sheet1 += `\n      <c r="AD${rReal}" s="9"><f>SUM(B${rReal}:AC${rReal})</f><v>0</v></c>`;
for (let c = 31; c <= 37; c++) sheet1 += `\n      <c r="${toColLetter(c)}${rReal}" s="9" t="inlineStr"><is><t>-</t></is></c>`;
sheet1 += `\n    </row>`;

// 3. PT A (row 54: 4〜13)
const rPtA = endRow + 3;
sheet1 += `\n    <row r="${rPtA}" ht="20">\n      <c r="A${rPtA}" s="10" t="inlineStr"><is><t>PT A 出勤</t></is></c>`;
for (let d = 0; d < 28; d++) {
    const col = toColLetter(2+d);
    sheet1 += `\n      <c r="${col}${rPtA}" s="10"><f>${makeWorkCountFormulaXml(`${col}$4:${col}$13`)}</f><v>0</v></c>`;
}
sheet1 += `\n      <c r="AD${rPtA}" s="10"><f>SUM(B${rPtA}:AC${rPtA})</f><v>0</v></c>`;
for (let c = 31; c <= 37; c++) sheet1 += `\n      <c r="${toColLetter(c)}${rPtA}" s="10" t="inlineStr"><is><t>-</t></is></c>`;
sheet1 += `\n    </row>`;

// 4. OT A (row 55: 14〜23)
const rOtA = endRow + 4;
sheet1 += `\n    <row r="${rOtA}" ht="20">\n      <c r="A${rOtA}" s="10" t="inlineStr"><is><t>OT A 出勤</t></is></c>`;
for (let d = 0; d < 28; d++) {
    const col = toColLetter(2+d);
    sheet1 += `\n      <c r="${col}${rOtA}" s="10"><f>${makeWorkCountFormulaXml(`${col}$14:${col}$23`)}</f><v>0</v></c>`;
}
sheet1 += `\n      <c r="AD${rOtA}" s="10"><f>SUM(B${rOtA}:AC${rOtA})</f><v>0</v></c>`;
for (let c = 31; c <= 37; c++) sheet1 += `\n      <c r="${toColLetter(c)}${rOtA}" s="10" t="inlineStr"><is><t>-</t></is></c>`;
sheet1 += `\n    </row>`;

// 5. PT B (row 56: 24〜33)
const rPtB = endRow + 5;
sheet1 += `\n    <row r="${rPtB}" ht="20">\n      <c r="A${rPtB}" s="11" t="inlineStr"><is><t>PT B 出勤</t></is></c>`;
for (let d = 0; d < 28; d++) {
    const col = toColLetter(2+d);
    sheet1 += `\n      <c r="${col}${rPtB}" s="11"><f>${makeWorkCountFormulaXml(`${col}$24:${col}$33`)}</f><v>0</v></c>`;
}
sheet1 += `\n      <c r="AD${rPtB}" s="11"><f>SUM(B${rPtB}:AC${rPtB})</f><v>0</v></c>`;
for (let c = 31; c <= 37; c++) sheet1 += `\n      <c r="${toColLetter(c)}${rPtB}" s="11" t="inlineStr"><is><t>-</t></is></c>`;
sheet1 += `\n    </row>`;

// 6. OT B (row 57: 34〜43)
const rOtB = endRow + 6;
sheet1 += `\n    <row r="${rOtB}" ht="20">\n      <c r="A${rOtB}" s="11" t="inlineStr"><is><t>OT B 出勤</t></is></c>`;
for (let d = 0; d < 28; d++) {
    const col = toColLetter(2+d);
    sheet1 += `\n      <c r="${col}${rOtB}" s="11"><f>${makeWorkCountFormulaXml(`${col}$34:${col}$43`)}</f><v>0</v></c>`;
}
sheet1 += `\n      <c r="AD${rOtB}" s="11"><f>SUM(B${rOtB}:AC${rOtB})</f><v>0</v></c>`;
for (let c = 31; c <= 37; c++) sheet1 += `\n      <c r="${toColLetter(c)}${rOtB}" s="11" t="inlineStr"><is><t>-</t></is></c>`;
sheet1 += `\n    </row>`;

// 7. ST (row 58: 44〜51)
const rSt = endRow + 7;
sheet1 += `\n    <row r="${rSt}" ht="20">\n      <c r="A${rSt}" s="12" t="inlineStr"><is><t>ST 出勤</t></is></c>`;
for (let d = 0; d < 28; d++) {
    const col = toColLetter(2+d);
    sheet1 += `\n      <c r="${col}${rSt}" s="12"><f>${makeWorkCountFormulaXml(`${col}$44:${col}$51`)}</f><v>0</v></c>`;
}
sheet1 += `\n      <c r="AD${rSt}" s="12"><f>SUM(B${rSt}:AC${rSt})</f><v>0</v></c>`;
for (let c = 31; c <= 37; c++) sheet1 += `\n      <c r="${toColLetter(c)}${rSt}" s="12" t="inlineStr"><is><t>-</t></is></c>`;
sheet1 += `\n    </row>`;

// 8. 早番 (row 59)
const rEarly = endRow + 8;
sheet1 += `\n    <row r="${rEarly}" ht="20">\n      <c r="A${rEarly}" s="13" t="inlineStr"><is><t>早番</t></is></c>`;
for (let d = 0; d < 28; d++) {
    const col = toColLetter(2+d);
    sheet1 += `\n      <c r="${col}${rEarly}" s="13"><f>COUNTIF(${col}$4:${col}$51,&quot;早&quot;)+COUNTIF(${col}$4:${col}$51,&quot;ハヤ&quot;)</f><v>0</v></c>`;
}
sheet1 += `\n      <c r="AD${rEarly}" s="13"><f>SUM(B${rEarly}:AC${rEarly})</f><v>0</v></c>`;
for (let c = 31; c <= 37; c++) sheet1 += `\n      <c r="${toColLetter(c)}${rEarly}" s="13" t="inlineStr"><is><t>-</t></is></c>`;
sheet1 += `\n    </row>`;

// 9. 遅番 (row 60)
const rLate = endRow + 9;
sheet1 += `\n    <row r="${rLate}" ht="20">\n      <c r="A${rLate}" s="13" t="inlineStr"><is><t>遅番</t></is></c>`;
for (let d = 0; d < 28; d++) {
    const col = toColLetter(2+d);
    sheet1 += `\n      <c r="${col}${rLate}" s="13"><f>COUNTIF(${col}$4:${col}$51,&quot;遅&quot;)+COUNTIF(${col}$4:${col}$51,&quot;オソ&quot;)</f><v>0</v></c>`;
}
sheet1 += `\n      <c r="AD${rLate}" s="13"><f>SUM(B${rLate}:AC${rLate})</f><v>0</v></c>`;
for (let c = 31; c <= 37; c++) sheet1 += `\n      <c r="${toColLetter(c)}${rLate}" s="13" t="inlineStr"><is><t>-</t></is></c>`;
sheet1 += `\n    </row>`;

// 10. E (row 61)
const rEve = endRow + 10;
sheet1 += `\n    <row r="${rEve}" ht="20">\n      <c r="A${rEve}" s="13" t="inlineStr"><is><t>E</t></is></c>`;
for (let d = 0; d < 28; d++) {
    const col = toColLetter(2+d);
    sheet1 += `\n      <c r="${col}${rEve}" s="13"><f>COUNTIF(${col}$4:${col}$51,&quot;E&quot;)+COUNTIF(${col}$4:${col}$51,&quot;イブ&quot;)</f><v>0</v></c>`;
}
sheet1 += `\n      <c r="AD${rEve}" s="13"><f>SUM(B${rEve}:AC${rEve})</f><v>0</v></c>`;
for (let c = 31; c <= 37; c++) sheet1 += `\n      <c r="${toColLetter(c)}${rEve}" s="13" t="inlineStr"><is><t>-</t></is></c>`;
sheet1 += `\n    </row>`;

// 11. 8時 (row 62)
const rH8 = endRow + 11;
sheet1 += `\n    <row r="${rH8}" ht="20">\n      <c r="A${rH8}" s="13" t="inlineStr"><is><t>8時</t></is></c>`;
for (let d = 0; d < 28; d++) {
    const col = toColLetter(2+d);
    sheet1 += `\n      <c r="${col}${rH8}" s="13"><f>COUNTIF(${col}$4:${col}$51,&quot;8時&quot;)</f><v>0</v></c>`;
}
sheet1 += `\n      <c r="AD${rH8}" s="13"><f>SUM(B${rH8}:AC${rH8})</f><v>0</v></c>`;
for (let c = 31; c <= 37; c++) sheet1 += `\n      <c r="${toColLetter(c)}${rH8}" s="13" t="inlineStr"><is><t>-</t></is></c>`;
sheet1 += `\n    </row>`;

sheet1 += `\n  </sheetData>
  <pageMargins left="0.25" right="0.25" top="0.3" bottom="0.3" header="0.2" footer="0.2"/>
  <pageSetup paperSize="8" orientation="landscape" fitToWidth="1" fitToHeight="1"/>
</worksheet>`;

// unzip styles from test_exp2_oksheet.xlsx
const buf = fs.readFileSync('test_exp2_oksheet.xlsx');
let pos = 0; let stData = '';
while (pos < buf.length - 4) {
    const sig = buf.readUInt32LE(pos);
    if (sig === 0x04034b50) {
        const nameLen = buf.readUInt16LE(pos + 26);
        const extraLen = buf.readUInt16LE(pos + 28);
        const compSize = buf.readUInt32LE(pos + 18);
        const name = buf.toString('utf8', pos + 30, pos + 30 + nameLen);
        const dataStart = pos + 30 + nameLen + extraLen;
        if (name === 'xl/styles.xml') stData = buf.subarray(dataStart, dataStart + compSize);
        pos = dataStart + compSize;
    } else break;
}

const files = [
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rels },
    { name: 'xl/workbook.xml', data: workbook },
    { name: 'xl/_rels/workbook.xml.rels', data: wbRels },
    { name: 'xl/styles.xml', data: stData },
    { name: 'xl/worksheets/sheet1.xml', data: sheet1 }
];

fs.writeFileSync('test_case_H_full_static.xlsx', Buffer.from(zipFiles(files)));
console.log('Case H (full schedule with static formulas) written successfully!');
