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

function createZipUint8Array(files) {
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

function unzipEntries(fname) {
    const buf = fs.readFileSync(fname);
    const entries = {};
    let pos = 0;
    while (pos < buf.length - 4) {
        const sig = buf.readUInt32LE(pos);
        if (sig === 0x04034b50) {
            const nameLen = buf.readUInt16LE(pos + 26);
            const extraLen = buf.readUInt16LE(pos + 28);
            const compSize = buf.readUInt32LE(pos + 18);
            const name = buf.toString('utf8', pos + 30, pos + 30 + nameLen);
            const dataStart = pos + 30 + nameLen + extraLen;
            entries[name] = buf.subarray(dataStart, dataStart + compSize);
            pos = dataStart + compSize;
        } else break;
    }
    return entries;
}

// ユーザーがダウンロードしたファイルと同じ名前・同じシート名（スラッシュ入り）と、修正後（スラッシュなし）を比較
const ok = unzipEntries('test_prod_with_all_styles.xlsx');

// 1. スラッシュ入りシート名 (旧: 4/1～4/28勤務表)
const wbSlash = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="4/1～4/28勤務表" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

// 2. スラッシュなし安全シート名 (新: 4月1日～4月28日勤務表)
const wbSafe = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="4月1日～4月28日勤務表" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

const fSlash = [
    { name: '[Content_Types].xml', data: ok['[Content_Types].xml'] },
    { name: '_rels/.rels', data: ok['_rels/.rels'] },
    { name: 'xl/workbook.xml', data: wbSlash },
    { name: 'xl/_rels/workbook.xml.rels', data: ok['xl/_rels/workbook.xml.rels'] },
    { name: 'xl/styles.xml', data: ok['xl/styles.xml'] },
    { name: 'xl/worksheets/sheet1.xml', data: ok['xl/worksheets/sheet1.xml'] }
];
fs.writeFileSync('test_slash_sheetname.xlsx', Buffer.from(createZipUint8Array(fSlash)));

const fSafe = [
    { name: '[Content_Types].xml', data: ok['[Content_Types].xml'] },
    { name: '_rels/.rels', data: ok['_rels/.rels'] },
    { name: 'xl/workbook.xml', data: wbSafe },
    { name: 'xl/_rels/workbook.xml.rels', data: ok['xl/_rels/workbook.xml.rels'] },
    { name: 'xl/styles.xml', data: ok['xl/styles.xml'] },
    { name: 'xl/worksheets/sheet1.xml', data: ok['xl/worksheets/sheet1.xml'] }
];
fs.writeFileSync('test_safe_sheetname.xlsx', Buffer.from(createZipUint8Array(fSafe)));

console.log('Both test files generated successfully!');
