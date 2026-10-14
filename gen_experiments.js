const fs = require('fs');

// OKな verified_staff_blank_template.xlsx の styles.xml を使って、
// NGな test_export_generated.xlsx を修正してみる実験
const testScript = `
const fs = require('fs');

function unzipEntries(buf) {
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
        } else {
            break;
        }
    }
    return entries;
}

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
    const buf = Buffer.alloc(totalSize);
    let pos = 0;

    fileEntries.forEach(f => {
        buf.writeUInt32LE(0x04034b50, pos); pos += 4;
        buf.writeUInt16LE(20, pos); pos += 2;
        buf.writeUInt16LE(0x0800, pos); pos += 2;
        buf.writeUInt16LE(0, pos); pos += 2;
        buf.writeUInt16LE(0x4a21, pos); pos += 2;
        buf.writeUInt16LE(0x5894, pos); pos += 2;
        buf.writeUInt32LE(f.crc, pos); pos += 4;
        buf.writeUInt32LE(f.size, pos); pos += 4;
        buf.writeUInt32LE(f.size, pos); pos += 4;
        buf.writeUInt16LE(f.nameBytes.length, pos); pos += 2;
        buf.writeUInt16LE(0, pos); pos += 2;
        f.nameBytes.copy(buf, pos); pos += f.nameBytes.length;
        f.dataBytes.copy(buf, pos); pos += f.size;
    });

    const cdOffset = pos;
    fileEntries.forEach(f => {
        buf.writeUInt32LE(0x02014b50, pos); pos += 4;
        buf.writeUInt16LE(20, pos); pos += 2;
        buf.writeUInt16LE(20, pos); pos += 2;
        buf.writeUInt16LE(0x0800, pos); pos += 2;
        buf.writeUInt16LE(0, pos); pos += 2;
        buf.writeUInt16LE(0x4a21, pos); pos += 2;
        buf.writeUInt16LE(0x5894, pos); pos += 2;
        buf.writeUInt32LE(f.crc, pos); pos += 4;
        buf.writeUInt32LE(f.size, pos); pos += 4;
        buf.writeUInt32LE(f.size, pos); pos += 4;
        buf.writeUInt16LE(f.nameBytes.length, pos); pos += 2;
        buf.writeUInt16LE(0, pos); pos += 2;
        buf.writeUInt16LE(0, pos); pos += 2;
        buf.writeUInt16LE(0, pos); pos += 2;
        buf.writeUInt16LE(0, pos); pos += 2;
        buf.writeUInt32LE(0, pos); pos += 4;
        buf.writeUInt32LE(f.offset, pos); pos += 4;
        f.nameBytes.copy(buf, pos); pos += f.nameBytes.length;
    });

    buf.writeUInt32LE(0x06054b50, pos); pos += 4;
    buf.writeUInt16LE(0, pos); pos += 2;
    buf.writeUInt16LE(0, pos); pos += 2;
    buf.writeUInt16LE(fileEntries.length, pos); pos += 2;
    buf.writeUInt16LE(fileEntries.length, pos); pos += 2;
    buf.writeUInt32LE(centralDirSize, pos); pos += 4;
    buf.writeUInt32LE(cdOffset, pos); pos += 4;
    buf.writeUInt16LE(0, pos); pos += 2;

    return buf;
}

const ngEntries = unzipEntries(fs.readFileSync('test_export_generated.xlsx'));
const okEntries = unzipEntries(fs.readFileSync('verified_staff_blank_template.xlsx'));

// 実験1: styles.xml を OK のもの（または修正版）に差し替える
const exp1 = [
    { name: '[Content_Types].xml', data: ngEntries['[Content_Types].xml'] },
    { name: '_rels/.rels', data: ngEntries['_rels/.rels'] },
    { name: 'xl/workbook.xml', data: ngEntries['xl/workbook.xml'] },
    { name: 'xl/_rels/workbook.xml.rels', data: ngEntries['xl/_rels/workbook.xml.rels'] },
    { name: 'xl/styles.xml', data: okEntries['xl/styles.xml'] }, // OKのstyles
    { name: 'xl/worksheets/sheet1.xml', data: ngEntries['xl/worksheets/sheet1.xml'] }
];
fs.writeFileSync('test_exp1_okstyles.xlsx', zipFiles(exp1));

// 実験2: sheet1.xml を OK のもの（OKのsheet1 + NGのstyles）
const exp2 = [
    { name: '[Content_Types].xml', data: ngEntries['[Content_Types].xml'] },
    { name: '_rels/.rels', data: ngEntries['_rels/.rels'] },
    { name: 'xl/workbook.xml', data: ngEntries['xl/workbook.xml'] },
    { name: 'xl/_rels/workbook.xml.rels', data: ngEntries['xl/_rels/workbook.xml.rels'] },
    { name: 'xl/styles.xml', data: ngEntries['xl/styles.xml'] },
    { name: 'xl/worksheets/sheet1.xml', data: okEntries['xl/worksheets/sheet1.xml'] } // OKのsheet1
];
fs.writeFileSync('test_exp2_oksheet.xlsx', zipFiles(exp2));

// 実験3: 両方OK（zipFiles実装自体の検証）
const exp3 = [
    { name: '[Content_Types].xml', data: okEntries['[Content_Types].xml'] },
    { name: '_rels/.rels', data: okEntries['_rels/.rels'] },
    { name: 'xl/workbook.xml', data: okEntries['xl/workbook.xml'] },
    { name: 'xl/_rels/workbook.xml.rels', data: okEntries['xl/_rels/workbook.xml.rels'] },
    { name: 'xl/styles.xml', data: okEntries['xl/styles.xml'] },
    { name: 'xl/worksheets/sheet1.xml', data: okEntries['xl/worksheets/sheet1.xml'] }
];
fs.writeFileSync('test_exp3_allok.xlsx', zipFiles(exp3));

console.log('Experiments written!');
`;

fs.writeFileSync('test_experiments.js', testScript);
