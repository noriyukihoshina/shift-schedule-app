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
        view.setUint16(pos, 0x0800, true); pos += 2; // UTF-8
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

function makeWorkCountFormulaXml(range) {
    const symbols = ['○', '〇', '出', '早', '遅', 'E', '8時', 'ハヤ', 'オソ', 'イブ'];
    return `SUM(${symbols.map(s => `COUNTIF(${range},&quot;${s}&quot;)`).join(',')})`;
}

// テスト用データ生成
function testGenerateXlsx() {
    const title = '2026年4月1日～4月28日 勤務表';

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
    <sheet name="勤務表" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

    const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

    // スタイル定義
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
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
    <font><b/><sz val="9"/><name val="Meiryo"/><color rgb="0284C7"/></font> <!-- 8: 土曜ヘッダー青 -->
    <font><b/><sz val="9"/><name val="Meiryo"/><color rgb="E11D48"/></font> <!-- 9: 日祝ヘッダー赤 -->
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
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf> <!-- 2: header normal -->
    <xf numFmtId="0" fontId="8" fillId="3" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf> <!-- 3: header sat -->
    <xf numFmtId="0" fontId="9" fillId="4" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf> <!-- 4: header sun -->
    <xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0"><alignment horizontal="left" vertical="center"/></xf> <!-- 5: staff name -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf> <!-- 6: work symbol auto -->
    <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf> <!-- 7: 🔒work symbol fixed red -->
    <xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf> <!-- 8: staff stat black bold -->
    <xf numFmtId="0" fontId="1" fillId="5" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf> <!-- 9: total work & real sum -->
    <xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf> <!-- 10: PT/OT A orange -->
    <xf numFmtId="0" fontId="5" fillId="0" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf> <!-- 11: PT/OT B blue -->
    <xf numFmtId="0" fontId="6" fillId="0" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf> <!-- 12: ST pink -->
    <xf numFmtId="0" fontId="7" fillId="0" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf> <!-- 13: early/late/eve/h8 gray -->
    <xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0"><alignment horizontal="left" vertical="center"/></xf> <!-- 14: footer label -->
  </cellXfs>
</styleSheet>`;

    // sheet1.xml
    let sheet1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr>
    <pageSetUpPr fitToPage="1"/>
  </sheetPr>
  <sheetViews><sheetView tabSelected="1" workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>
    <col min="1" max="1" width="16" customWidth="1"/> <!-- A: 氏名 (約115px) -->
    <col min="2" max="29" width="4.8" customWidth="1"/> <!-- B〜AC: 28日分 -->
    <col min="30" max="33" width="7" customWidth="1"/> <!-- AD〜AG: 出勤, 公休, 有休, リフ -->
    <col min="34" max="37" width="5.5" customWidth="1"/> <!-- AH〜AK: 早, 遅, E, 8時 -->
  </cols>
  <sheetData>
    <row r="1" ht="22" customHeight="1">
      <c r="A1" s="1" t="inlineStr"><is><t>${title}</t></is></c>
    </row>
    <row r="2" ht="20" customHeight="1">
      <c r="A2" s="2" t="inlineStr"><is><t>氏名</t></is></c>
      <c r="B2" s="2" t="inlineStr"><is><t>4/1</t></is></c>
      <c r="AD2" s="2" t="inlineStr"><is><t>出勤</t></is></c>
      <c r="AE2" s="2" t="inlineStr"><is><t>公休</t></is></c>
      <c r="AF2" s="2" t="inlineStr"><is><t>有休</t></is></c>
      <c r="AG2" s="2" t="inlineStr"><is><t>リフ</t></is></c>
      <c r="AH2" s="2" t="inlineStr"><is><t>早</t></is></c>
      <c r="AI2" s="2" t="inlineStr"><is><t>遅</t></is></c>
      <c r="AJ2" s="2" t="inlineStr"><is><t>E</t></is></c>
      <c r="AK2" s="2" t="inlineStr"><is><t>8時</t></is></c>
    </row>
  </sheetData>
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
    fs.writeFileSync(path.join(__dirname, 'test_output.xlsx'), zipBuf);
    console.log('Successfully wrote test_output.xlsx, size:', zipBuf.length);
}

testGenerateXlsx();
