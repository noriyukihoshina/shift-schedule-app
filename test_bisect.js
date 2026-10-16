const fs = require('fs');
const path = require('path');

// ZIP読み込み関数
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

function zipEntries(entriesObj) {
    const textEncoder = new TextEncoder();
    const files = Object.keys(entriesObj).map(name => {
        const val = entriesObj[name];
        const dataBytes = (typeof val === 'string') ? Buffer.from(val, 'utf8') : val;
        const nameBytes = Buffer.from(name, 'utf8');
        return {
            name,
            nameBytes,
            dataBytes,
            crc: calcZipCrc32(dataBytes),
            size: dataBytes.length
        };
    });

    let localHeadersSize = 0;
    files.forEach(f => {
        f.offset = localHeadersSize;
        localHeadersSize += 30 + f.nameBytes.length + f.size;
    });

    let centralDirSize = 0;
    files.forEach(f => {
        centralDirSize += 46 + f.nameBytes.length;
    });

    const totalSize = localHeadersSize + centralDirSize + 22;
    const buf = Buffer.alloc(totalSize);
    let pos = 0;

    files.forEach(f => {
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
    files.forEach(f => {
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
    buf.writeUInt16LE(files.length, pos); pos += 2;
    buf.writeUInt16LE(files.length, pos); pos += 2;
    buf.writeUInt32LE(centralDirSize, pos); pos += 4;
    buf.writeUInt32LE(cdOffset, pos); pos += 4;
    buf.writeUInt16LE(0, pos); pos += 2;

    return buf;
}

const validEntries = unzipEntries(fs.readFileSync('test_valid_template.xlsx'));
const badEntries = unzipEntries(fs.readFileSync('test_export_generated.xlsx'));

console.log('validEntries keys:', Object.keys(validEntries));
console.log('badEntries keys:', Object.keys(badEntries));

// 1. validベースで sheet1 だけ bad
const test1 = { ...validEntries, 'xl/worksheets/sheet1.xml': badEntries['xl/worksheets/sheet1.xml'] };
fs.writeFileSync('test_bisect_1_sheet1.xlsx', zipEntries(test1));

// 2. validベースで styles だけ bad
const test2 = { ...validEntries, 'xl/styles.xml': badEntries['xl/styles.xml'] };
fs.writeFileSync('test_bisect_2_styles.xlsx', zipEntries(test2));

// 3. validベースで workbook だけ bad
const test3 = { ...validEntries, 'xl/workbook.xml': badEntries['xl/workbook.xml'] };
fs.writeFileSync('test_bisect_3_wb.xlsx', zipEntries(test3));

// 4. validベースを再度zipEntriesで固めたもの（zip生成器自体のチェック）
fs.writeFileSync('test_bisect_0_repack.xlsx', zipEntries(validEntries));

console.log('Bisect files written!');
