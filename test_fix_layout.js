const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
    let crc = ~0;
    for (let i = 0; i < buf.length; i++) {
        crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
    }
    return (crc ^ -1) >>> 0;
}
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    crcTable[i] = c;
}

function zipFiles(files) {
    const localHeaders = [];
    const cdHeaders = [];
    let offset = 0;

    files.forEach(f => {
        const nameBuf = Buffer.from(f.name, 'utf8');
        const dataBuf = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data, 'utf8');
        const deflated = zlib.deflateRawSync(dataBuf);
        const crc = crc32(dataBuf);

        const lh = Buffer.alloc(30 + nameBuf.length);
        lh.writeUInt32LE(0x04034b50, 0);
        lh.writeUInt16LE(20, 4);
        lh.writeUInt16LE(0, 6);
        lh.writeUInt16LE(8, 8);
        lh.writeUInt16LE(0, 10);
        lh.writeUInt16LE(0, 12);
        lh.writeUInt32LE(crc, 14);
        lh.writeUInt32LE(deflated.length, 18);
        lh.writeUInt32LE(dataBuf.length, 22);
        lh.writeUInt16LE(nameBuf.length, 26);
        lh.writeUInt16LE(0, 28);
        nameBuf.copy(lh, 30);

        localHeaders.push(lh, deflated);

        const cdh = Buffer.alloc(46 + nameBuf.length);
        cdh.writeUInt32LE(0x02014b50, 0);
        cdh.writeUInt16LE(20, 4);
        cdh.writeUInt16LE(20, 6);
        cdh.writeUInt16LE(0, 8);
        cdh.writeUInt16LE(8, 10);
        cdh.writeUInt16LE(0, 12);
        cdh.writeUInt16LE(0, 14);
        cdh.writeUInt32LE(crc, 16);
        cdh.writeUInt32LE(deflated.length, 20);
        cdh.writeUInt32LE(dataBuf.length, 24);
        cdh.writeUInt16LE(nameBuf.length, 28);
        cdh.writeUInt16LE(0, 30);
        cdh.writeUInt16LE(0, 32);
        cdh.writeUInt16LE(0, 34);
        cdh.writeUInt16LE(0, 36);
        cdh.writeUInt32LE(0, 38);
        cdh.writeUInt32LE(offset, 42);
        nameBuf.copy(cdh, 46);

        cdHeaders.push(cdh);
        offset += lh.length + deflated.length;
    });

    const cdStart = offset;
    const cdBuf = Buffer.concat(cdHeaders);
    const cdSize = cdBuf.length;

    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(files.length, 8);
    eocd.writeUInt16LE(files.length, 10);
    eocd.writeUInt32LE(cdSize, 12);
    eocd.writeUInt32LE(cdStart, 16);
    eocd.writeUInt16LE(0, 20);

    return Buffer.concat([...localHeaders, cdBuf, eocd]);
}

function toColLetter(cIdx) {
    let str = '';
    let n = cIdx;
    while (n > 0) {
        let m = (n - 1) % 26;
        str = String.fromCharCode(65 + m) + str;
        n = Math.floor((n - m) / 26);
    }
    return str;
}

const NUM_DAYS = 28;
const safeSheetName = '4月1日～4月28日勤務表';
const title = '4月1日～4月28日 勤務表';

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
    <sheet name="${safeSheetName}" sheetId="1" r:id="rId1"/>
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

let sheet1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr>
    <pageSetUpPr fitToPage="1"/>
  </sheetPr>
  <sheetViews><sheetView tabSelected="1" workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>
    <col min="1" max="1" width="17.0" customWidth="1"/>
    <col min="2" max="29" width="7.5" customWidth="1"/>
    <col min="30" max="32" width="13.0" customWidth="1"/>
    <col min="33" max="37" width="9.5" customWidth="1"/>
  </cols>
  <sheetData>
    <row r="1" ht="28" customHeight="1">
      <c r="A1" s="1" t="inlineStr"><is><t>${title}</t></is></c>
      <c r="AD1" s="2" t="inlineStr"><is><t>勤務・休暇 集計</t></is></c>
    </row>
    <row r="2" ht="24" customHeight="1">
      <c r="A2" s="2" t="inlineStr"><is><t>氏名</t></is></c>`;

for (let d = 0; d < NUM_DAYS; d++) {
    const col = toColLetter(2 + d);
    sheet1 += `\n      <c r="${col}2" s="2" t="inlineStr"><is><t>4/${d + 1}</t></is></c>`;
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
    <row r="3" ht="20" customHeight="1">
      <c r="A3" s="2"/>`;

for (let d = 0; d < NUM_DAYS; d++) {
    const col = toColLetter(2 + d);
    sheet1 += `\n      <c r="${col}3" s="2" t="inlineStr"><is><t>水</t></is></c>`;
}
sheet1 += `\n      <c r="AD3" s="2"/><c r="AE3" s="2"/><c r="AF3" s="2"/><c r="AG3" s="2"/><c r="AH3" s="2"/><c r="AI3" s="2"/><c r="AJ3" s="2"/><c r="AK3" s="2"/>
    </row>`;

// スタッフ行 (row 4〜51: 48名分)
for (let s = 0; s < 48; s++) {
    const r = 4 + s;
    const rng = `B${r}:AC${r}`;
    sheet1 += `\n    <row r="${r}" ht="41.25" customHeight="1">
      <c r="A${r}" s="5" t="inlineStr"><is><t>スタッフ ${String(s + 1).padStart(2, '0')}</t></is></c>`;
    for (let d = 0; d < NUM_DAYS; d++) {
        const col = toColLetter(2 + d);
        sheet1 += `\n      <c r="${col}${r}" s="6" t="inlineStr"><is><t>〇</t></is></c>`;
    }
    sheet1 += `\n      <c r="AD${r}" s="8"><f>COUNTIF(${rng},&quot;〇&quot;)</f><v>20</v></c>
      <c r="AE${r}" s="8"><f>COUNTIF(${rng},&quot;休&quot;)</f><v>8</v></c>
      <c r="AF${r}" s="8"><f>COUNTIF(${rng},&quot;有&quot;)</f><v>0</v></c>
      <c r="AG${r}" s="8"><f>COUNTIF(${rng},&quot;リフ&quot;)</f><v>0</v></c>
      <c r="AH${r}" s="13"><f>COUNTIF(${rng},&quot;早&quot;)</f><v>1</v></c>
      <c r="AI${r}" s="13"><f>COUNTIF(${rng},&quot;遅&quot;)</f><v>1</v></c>
      <c r="AJ${r}" s="13"><f>COUNTIF(${rng},&quot;E&quot;)</f><v>1</v></c>
      <c r="AK${r}" s="13"><f>COUNTIF(${rng},&quot;8時&quot;)</f><v>3</v></c>
    </row>`;
}

// カウンター行 (row 52〜62)
const rWork = 52;
sheet1 += `\n    <row r="${rWork}" ht="33.75" customHeight="1">
      <c r="A${rWork}" s="9" t="inlineStr"><is><t>出勤人数合計</t></is></c>`;
for (let d = 0; d < NUM_DAYS; d++) {
    const col = toColLetter(2 + d);
    sheet1 += `\n      <c r="${col}${rWork}" s="9"><f>SUM(${col}$4:${col}$51)</f><v>35</v></c>`;
}
sheet1 += `\n      <c r="AD${rWork}" s="9"><f>SUM(AD$4:AD$51)</f><v>960</v></c>
      <c r="AE${rWork}" s="9"><f>SUM(AE$4:AE$51)</f><v>384</v></c>
      <c r="AF${rWork}" s="9"><f>SUM(AF$4:AF$51)</f><v>0</v></c>
      <c r="AG${rWork}" s="9"><f>SUM(AG$4:AG$51)</f><v>0</v></c>
      <c r="AH${rWork}" s="13"><f>SUM(AH$4:AH$51)</f><v>48</v></c>
      <c r="AI${rWork}" s="13"><f>SUM(AI$4:AI$51)</f><v>48</v></c>
      <c r="AJ${rWork}" s="13"><f>SUM(AJ$4:AJ$51)</f><v>48</v></c>
      <c r="AK${rWork}" s="13"><f>SUM(AK$4:AK$51)</f><v>144</v></c>
    </row>
  </sheetData>
  <mergeCells count="2">
    <mergeCell ref="A1:AC1"/>
    <mergeCell ref="AD1:AK1"/>
  </mergeCells>
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

const buf = zipFiles(files);
fs.writeFileSync('test_verified_layout.xlsx', buf);
console.log('test_verified_layout.xlsx generated successfully! Size:', buf.length);
