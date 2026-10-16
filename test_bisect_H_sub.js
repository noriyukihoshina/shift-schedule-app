
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

function makeFile(fname, sheetXml) {
    const files = [
        { name: '[Content_Types].xml', data: contentTypes },
        { name: '_rels/.rels', data: rels },
        { name: 'xl/workbook.xml', data: workbook },
        { name: 'xl/_rels/workbook.xml.rels', data: wbRels },
        { name: 'xl/styles.xml', data: stData },
        { name: 'xl/worksheets/sheet1.xml', data: sheetXml }
    ];
    fs.writeFileSync(fname, Buffer.from(zipFiles(files)));
}

// Case H の各フッター行を1つずつテスト
// H4 は row 52 に COUNTIF(B4:B51,"〇") 1つだけだった。
// では、row 52 の 28日分全部に makeWorkCountFormulaXml を適用するとどうなるか？
// makeWorkCountFormulaXml(range): SUM(COUNTIF(...), COUNTIF(...)...)
function makeWorkCountFormulaXml(rng) {
    const symbols = ['○', '〇', '出', '早', '遅', 'E', '8時', 'ハヤ', 'オソ', 'イブ'];
    return `SUM(${symbols.map(s => `COUNTIF(${rng},&quot;${s}&quot;)`).join(',')})`;
}

// H_test1: row 52 に 28日分の makeWorkCountFormulaXml を設定
// H_test2: row 52 に AD〜AK の SUM(AD$4:AD51) などを設定
// H_test3: row 53 (実数合計) を追加
// H_test4: row 54〜58 (PT A, OT A, PT B, OT B, ST) を追加
// H_test5: row 59〜62 (早番, 遅番, E, 8時) を追加

// まずベースとなる 48人スタッフシート
let base = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
base += '\n  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>';
base += '\n  <sheetViews><sheetView tabSelected="1" workbookViewId="0"/></sheetViews>';
base += '\n  <sheetFormatPr defaultRowHeight="18"/>';
base += '\n  <cols>\n    <col min="1" max="1" width="16" customWidth="1"/>\n    <col min="2" max="29" width="4.0" customWidth="1"/>\n    <col min="30" max="33" width="7" customWidth="1"/>\n    <col min="34" max="37" width="4.0" customWidth="1"/>\n  </cols>';
base += '\n  <sheetData>';
base += '\n    <row r="1" ht="24"><c r="A1" s="1" t="inlineStr"><is><t>2026年4月勤務表</t></is></c></row>';
base += '\n    <row r="2"><c r="A2" s="2" t="inlineStr"><is><t>氏名</t></is></c>';
for (let d = 0; d < 28; d++) base += `\n      <c r="${toColLetter(2+d)}2" s="2" t="inlineStr"><is><t>4/${d+1}</t></is></c>`;
base += '\n    </row>';
base += '\n    <row r="3"><c r="A3" s="2"/>';
for (let d = 0; d < 28; d++) base += `\n      <c r="${toColLetter(2+d)}3" s="2" t="inlineStr"><is><t>水</t></is></c>`;
base += '\n    </row>';

for (let i = 1; i <= 48; i++) {
    const r = 3 + i;
    const rng = `B${r}:AC${r}`;
    base += `\n    <row r="${r}">\n      <c r="A${r}" s="5" t="inlineStr"><is><t>スタッフ${i}</t></is></c>`;
    for (let d = 0; d < 28; d++) base += `\n      <c r="${toColLetter(2+d)}${r}" s="6" t="inlineStr"><is><t>〇</t></is></c>`;
    const fWork = makeWorkCountFormulaXml(rng);
    const fOff = `COUNTIF(${rng},&quot;休&quot;)+0.5*(COUNTIF(${rng},&quot;○/休&quot;)+COUNTIF(${rng},&quot;〇/休&quot;)+COUNTIF(${rng},&quot;休/○&quot;)+COUNTIF(${rng},&quot;休/〇&quot;))`;
    const fPaid = `COUNTIF(${rng},&quot;有&quot;)+0.5*(COUNTIF(${rng},&quot;○/有&quot;)+COUNTIF(${rng},&quot;〇/有&quot;)+COUNTIF(${rng},&quot;有/○&quot;)+COUNTIF(${rng},&quot;有/〇&quot;))`;
    const fRef = `COUNTIF(${rng},&quot;上1&quot;)+COUNTIF(${rng},&quot;上2&quot;)+COUNTIF(${rng},&quot;上3&quot;)+COUNTIF(${rng},&quot;上4&quot;)+COUNTIF(${rng},&quot;上5&quot;)+COUNTIF(${rng},&quot;下1&quot;)+COUNTIF(${rng},&quot;下2&quot;)+COUNTIF(${rng},&quot;下3&quot;)`;
    const fEarly = `COUNTIF(${rng},&quot;早&quot;)+COUNTIF(${rng},&quot;ハヤ&quot;)`;
    base += `\n      <c r="AD${r}" s="8"><f>${fWork}</f><v>0</v></c>`;
    base += `\n      <c r="AE${r}" s="8"><f>${fOff}</f><v>0</v></c>`;
    base += `\n      <c r="AF${r}" s="8"><f>${fPaid}</f><v>0</v></c>`;
    base += `\n      <c r="AG${r}" s="8"><f>${fRef}</f><v>0</v></c>`;
    base += `\n      <c r="AH${r}" s="13"><f>${fEarly}</f><v>0</v></c>`;
    base += '\n    </row>';
}

const tail = '\n  </sheetData>\n  <pageMargins left="0.25" right="0.25" top="0.3" bottom="0.3" header="0.2" footer="0.2"/>\n  <pageSetup paperSize="8" orientation="landscape" fitToWidth="1" fitToHeight="1"/>\n</worksheet>';

// 1. row 52 28日分
let r52_28days = '\n    <row r="52"><c r="A52" s="9" t="inlineStr"><is><t>出勤人数合計</t></is></c>';
for (let d = 0; d < 28; d++) {
    const col = toColLetter(2+d);
    r52_28days += `\n      <c r="${col}52" s="9"><f>${makeWorkCountFormulaXml(`${col}$4:${col}$51`)}</f><v>0</v></c>`;
}
r52_28days += '\n    </row>';
makeFile('test_h_test1_r52_28days.xlsx', base + r52_28days + tail);

// 2. row 52 フル (28日分 + 右側集計)
let r52_full = r52_28days.replace('</row>', `      <c r="AD52" s="9"><f>SUM(AD$4:AD51)</f><v>0</v></c>\n      <c r="AE52" s="9"><f>SUM(AE$4:AE51)</f><v>0</v></c>\n      <c r="AF52" s="9"><f>SUM(AF$4:AF51)</f><v>0</v></c>\n      <c r="AG52" s="9"><f>SUM(AG$4:AG51)</f><v>0</v></c>\n      <c r="AH52" s="13"><f>SUM(AH$4:AH51)</f><v>0</v></c>\n    </row>`);
makeFile('test_h_test2_r52_full.xlsx', base + r52_full + tail);

// 3. row 53 (実数合計)
let r53 = '\n    <row r="53"><c r="A53" s="9" t="inlineStr"><is><t>実数合計</t></is></c>';
for (let d = 0; d < 28; d++) {
    const col = toColLetter(2+d);
    r53 += `\n      <c r="${col}53" s="9"><f>${col}52</f><v>0</v></c>`;
}
r53 += '\n      <c r="AD53" s="9"><f>SUM(B53:AC53)</f><v>0</v></c>\n    </row>';
makeFile('test_h_test3_r53.xlsx', base + r52_full + r53 + tail);

console.log('Sub-tests 1-3 written!');
