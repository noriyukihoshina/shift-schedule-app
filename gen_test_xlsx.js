const fs = require('fs');
const path = require('path');

// app.js から createZipUint8Array, calcZipCrc32, exportExcelSpreadsheet 相当の処理を抽出してテストファイルを生成
function calcZipCrc32(bytes) {
    let crc = 0xFFFFFFFF;
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[i] = c;
    }
    for (let i = 0; i < bytes.length; i++) {
        crc = table[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
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

    // Local headers & Data
    fileEntries.forEach(f => {
        view.setUint32(pos, 0x04034b50, true); pos += 4;
        view.setUint16(pos, 20, true); pos += 2;
        view.setUint16(pos, 0x0800, true); pos += 2; // UTF-8
        view.setUint16(pos, 0, true); pos += 2; // store (0)
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

    // Central Directory
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

    // End of Central Directory (EOCD)
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

// 模擬スタッフデータ (48名)
const staffList = [];
for (let i = 1; i <= 48; i++) {
    let sec = 'PT A';
    if (i > 10 && i <= 20) sec = 'OT A';
    else if (i > 20 && i <= 30) sec = 'PT B';
    else if (i > 30 && i <= 40) sec = 'OT B';
    else if (i > 40) sec = 'ST';
    staffList.push({ name: `スタッフ${i}`, section: sec, isUnused: false });
}

const term = {
    title: '2026年4月勤務表',
    dates: []
};
const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
for (let d = 0; d < 28; d++) {
    const day = d + 1;
    const wIdx = (d + 3) % 7; // 水曜始まり
    term.dates.push({
        m: 4,
        day: day,
        label: `4/${day}`,
        weekday: weekdays[wIdx],
        wIdx: wIdx,
        isHoliday: (wIdx === 0)
    });
}

// app.js から exportExcelSpreadsheet の XML 生成を再現
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
    <sheet name="${term.title.substring(0, 31)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="10">
    <font><sz val="9"/><name val="Meiryo"/><color rgb="000000"/></font>
    <font><b/><sz val="9"/><name val="Meiryo"/><color rgb="000000"/></font>
    <font><b/><sz val="9"/><name val="Meiryo"/><color rgb="DC2626"/></font>
    <font><b/><sz val="12"/><name val="Meiryo"/><color rgb="1E293B"/></font>
    <font><b/><sz val="9"/><name val="Meiryo"/><color rgb="EA580C"/></font>
    <font><b/><sz val="9"/><name val="Meiryo"/><color rgb="1D4ED8"/></font>
    <font><b/><sz val="9"/><name val="Meiryo"/><color rgb="EC4899"/></font>
    <font><b/><sz val="9"/><name val="Meiryo"/><color rgb="334155"/></font>
    <font><b/><sz val="9"/><name val="Meiryo"/><color rgb="0284C7"/></font>
    <font><b/><sz val="9"/><name val="Meiryo"/><color rgb="E11D48"/></font>
  </fonts>
  <fills count="6">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="F1F5F9"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="E0F2FE"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE4E6"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="F8FAFC"/></patternFill></fill>
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
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="8" fillId="3" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="9" fillId="4" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="5" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="0" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="6" fillId="0" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="7" fillId="0" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
  </cellXfs>
</styleSheet>`;

const validStaffIndices = staffList.map((_, i) => i);
const endRow = 3 + validStaffIndices.length;

function makeWorkCountFormulaXml(range) {
    const symbols = ['○', '〇', '出', '早', '遅', 'E', '8時', 'ハヤ', 'オソ', 'イブ'];
    return `SUM(${symbols.map(s => `COUNTIF(${range},&quot;${s}&quot;)`).join(',')})`;
}

let sheet1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr>
    <pageSetUpPr fitToPage="1"/>
  </sheetPr>
  <sheetViews><sheetView tabSelected="1" workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>
    <col min="1" max="1" width="16" customWidth="1"/>
    <col min="2" max="29" width="4.0" customWidth="1"/>
    <col min="30" max="33" width="7" customWidth="1"/>
    <col min="34" max="37" width="4.0" customWidth="1"/>
  </cols>
  <sheetData>
    <row r="1" ht="24" customHeight="1">
      <c r="A1" s="1" t="inlineStr"><is><t>${term.title}</t></is></c>
    </row>
    <row r="2" ht="20" customHeight="1">
      <c r="A2" s="2" t="inlineStr"><is><t>氏名</t></is></c>`;

for (let d = 0; d < 28; d++) {
    const di = term.dates[d];
    const col = toColLetter(2 + d);
    sheet1 += `\n      <c r="${col}2" s="2" t="inlineStr"><is><t>${di.label}</t></is></c>`;
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
    <row r="3" ht="18" customHeight="1">
      <c r="A3" s="2"/>`;
for (let d = 0; d < 28; d++) {
    const di = term.dates[d];
    const col = toColLetter(2 + d);
    let sIdx = 2;
    if (di.wIdx === 5) sIdx = 3;
    else if (di.wIdx === 6 || di.isHoliday) sIdx = 4;
    sheet1 += `\n      <c r="${col}3" s="${sIdx}" t="inlineStr"><is><t>${di.weekday}</t></is></c>`;
}
sheet1 += `\n      <c r="AD3" s="2"/><c r="AE3" s="2"/><c r="AF3" s="2"/><c r="AG3" s="2"/><c r="AH3" s="2"/><c r="AI3" s="2"/><c r="AJ3" s="2"/><c r="AK3" s="2"/>
    </row>`;

validStaffIndices.forEach((s, idx) => {
    const staff = staffList[s];
    const r = 4 + idx;
    const rng = `B${r}:AC${r}`;
    sheet1 += `\n    <row r="${r}" ht="20" customHeight="1">`;
    sheet1 += `\n      <c r="A${r}" s="5" t="inlineStr"><is><t>${staff.name}</t></is></c>`;

    for (let d = 0; d < 28; d++) {
        const col = toColLetter(2 + d);
        sheet1 += `\n      <c r="${col}${r}" s="6" t="inlineStr"><is><t>〇</t></is></c>`;
    }

    const fWork = makeWorkCountFormulaXml(rng);
    const fOff = `COUNTIF(${rng},&quot;休&quot;)+0.5*(COUNTIF(${rng},&quot;○/休&quot;)+COUNTIF(${rng},&quot;〇/休&quot;)+COUNTIF(${rng},&quot;休/○&quot;)+COUNTIF(${rng},&quot;休/〇&quot;))`;
    const fPaid = `COUNTIF(${rng},&quot;有&quot;)+0.5*(COUNTIF(${rng},&quot;○/有&quot;)+COUNTIF(${rng},&quot;〇/有&quot;)+COUNTIF(${rng},&quot;有/○&quot;)+COUNTIF(${rng},&quot;有/〇&quot;))`;
    const fRef = `COUNTIF(${rng},&quot;上1&quot;)+COUNTIF(${rng},&quot;上2&quot;)+COUNTIF(${rng},&quot;上3&quot;)+COUNTIF(${rng},&quot;上4&quot;)+COUNTIF(${rng},&quot;上5&quot;)+COUNTIF(${rng},&quot;下1&quot;)+COUNTIF(${rng},&quot;下2&quot;)+COUNTIF(${rng},&quot;下3&quot;)`;
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
});

// フッター
const rWork = endRow + 1;
sheet1 += `\n    <row r="${rWork}" ht="20" customHeight="1">
  <c r="A${rWork}" s="9" t="inlineStr"><is><t>出勤人数合計</t></is></c>`;
for (let d = 0; d < 28; d++) {
    const col = toColLetter(2 + d);
    sheet1 += `\n      <c r="${col}${rWork}" s="9"><f>${makeWorkCountFormulaXml(`INDIRECT(&quot;${col}$4:${col}&quot;&amp;(ROW()-1))`)}</f><v>0</v></c>`;
}
sheet1 += `\n      <c r="AD${rWork}" s="9"><f>SUM(INDIRECT(&quot;AD$4:AD&quot;&amp;(ROW()-1)))</f><v>0</v></c>`;
sheet1 += `\n      <c r="AE${rWork}" s="9"><f>SUM(INDIRECT(&quot;AE$4:AE&quot;&amp;(ROW()-1)))</f><v>0</v></c>`;
sheet1 += `\n      <c r="AF${rWork}" s="9"><f>SUM(INDIRECT(&quot;AF$4:AF&quot;&amp;(ROW()-1)))</f><v>0</v></c>`;
sheet1 += `\n      <c r="AG${rWork}" s="9"><f>SUM(INDIRECT(&quot;AG$4:AG&quot;&amp;(ROW()-1)))</f><v>0</v></c>`;
sheet1 += `\n      <c r="AH${rWork}" s="13"><f>SUM(INDIRECT(&quot;AH$4:AH&quot;&amp;(ROW()-1)))</f><v>0</v></c>`;
sheet1 += `\n      <c r="AI${rWork}" s="13"><f>SUM(INDIRECT(&quot;AI$4:AI&quot;&amp;(ROW()-1)))</f><v>0</v></c>`;
sheet1 += `\n      <c r="AJ${rWork}" s="13"><f>SUM(INDIRECT(&quot;AJ$4:AJ&quot;&amp;(ROW()-1)))</f><v>0</v></c>`;
sheet1 += `\n      <c r="AK${rWork}" s="13"><f>SUM(INDIRECT(&quot;AK$4:AK&quot;&amp;(ROW()-1)))</f><v>0</v></c>`;
sheet1 += `\n    </row>`;

sheet1 += `\n  </sheetData>
  <pageMargins left="0.25" right="0.25" top="0.3" bottom="0.3" header="0.2" footer="0.2"/>
  <pageSetup paperSize="8" orientation="landscape" fitToWidth="1" fitToHeight="1"/>
</worksheet>`;

const files = [
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rels },
    { name: 'xl/workbook.xml', data: workbook },
    { name: 'xl/_rels/workbook.xml.rels', data: wbRels },
    { name: 'xl/styles.xml', data: styles },
    { name: 'xl/worksheets/sheet1.xml', data: sheet1 }
];

const zipBuf = createZipUint8Array(files);
fs.writeFileSync(path.join(__dirname, 'test_export_generated.xlsx'), Buffer.from(zipBuf));
console.log('test_export_generated.xlsx written successfully!');
