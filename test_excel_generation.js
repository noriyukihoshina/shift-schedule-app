// test_excel_generation.js
// app.js から downloadBlankXlsx と exportExcelSpreadsheet の出力をテスト生成し、test_open_file.ps1 で検証する

const fs = require('fs');
const path = require('path');

// CRC32 and ZIP builder from app.js
function crc32(buf) {
    let table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[i] = c;
    }
    let crc = 0 ^ (-1);
    for (let i = 0; i < buf.length; i++) {
        crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
    }
    return (crc ^ (-1)) >>> 0;
}

function createZipUint8Array(files) {
    const encoder = new TextEncoder();
    const fileEntries = [];
    let localOffset = 0;

    for (const f of files) {
        const nameBytes = encoder.encode(f.name);
        const dataBytes = (typeof f.data === 'string') ? encoder.encode(f.data) : f.data;
        const crc = crc32(dataBytes);
        const compSize = dataBytes.length;
        const uncompSize = dataBytes.length;

        const localHeader = new Uint8Array(30 + nameBytes.length);
        const lView = new DataView(localHeader.buffer);
        lView.setUint32(0, 0x04034b50, true);
        lView.setUint16(4, 20, true);
        lView.setUint16(6, 0x0800, true); // UTF-8
        lView.setUint16(8, 0, true);
        lView.setUint16(10, 0, true);
        lView.setUint16(12, 0, true);
        lView.setUint32(14, crc, true);
        lView.setUint32(18, compSize, true);
        lView.setUint32(22, uncompSize, true);
        lView.setUint16(26, nameBytes.length, true);
        lView.setUint16(28, 0, true);
        localHeader.set(nameBytes, 30);

        fileEntries.push({
            nameBytes,
            dataBytes,
            crc,
            compSize,
            uncompSize,
            localOffset,
            localHeader
        });

        localOffset += localHeader.length + dataBytes.length;
    }

    const cdEntries = [];
    let cdSize = 0;
    for (const e of fileEntries) {
        const cdHdr = new Uint8Array(46 + e.nameBytes.length);
        const cView = new DataView(cdHdr.buffer);
        cView.setUint32(0, 0x02014b50, true);
        cView.setUint16(4, 20, true);
        cView.setUint16(6, 20, true);
        cView.setUint16(8, 0x0800, true);
        cView.setUint16(10, 0, true);
        cView.setUint16(12, 0, true);
        cView.setUint16(14, 0, true);
        cView.setUint32(16, e.crc, true);
        cView.setUint32(20, e.compSize, true);
        cView.setUint32(24, e.uncompSize, true);
        cView.setUint16(28, e.nameBytes.length, true);
        cView.setUint16(30, 0, true);
        cView.setUint16(32, 0, true);
        cView.setUint16(34, 0, true);
        cView.setUint16(36, 0, true);
        cView.setUint32(38, 0, true);
        cView.setUint32(42, e.localOffset, true);
        cdHdr.set(e.nameBytes, 46);

        cdEntries.push(cdHdr);
        cdSize += cdHdr.length;
    }

    const eocd = new Uint8Array(22);
    const eView = new DataView(eocd.buffer);
    eView.setUint32(0, 0x06054b50, true);
    eView.setUint16(4, 0, true);
    eView.setUint16(6, 0, true);
    eView.setUint16(8, fileEntries.length, true);
    eView.setUint16(10, fileEntries.length, true);
    eView.setUint32(12, cdSize, true);
    eView.setUint32(16, localOffset, true);
    eView.setUint16(20, 0, true);

    const totalLen = localOffset + cdSize + 22;
    const result = new Uint8Array(totalLen);
    let cur = 0;
    for (const e of fileEntries) {
        result.set(e.localHeader, cur);
        cur += e.localHeader.length;
        result.set(e.dataBytes, cur);
        cur += e.dataBytes.length;
    }
    for (const c of cdEntries) {
        result.set(c, cur);
        cur += c.length;
    }
    result.set(eocd, cur);
    return result;
}

console.log('test_excel_generation loaded.');
