const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// app.js から exportExcelSpreadsheet の XML 生成ロジックを取り出してテスト用 xlsx を出力
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

// ユーザー指示4に基づく最適なレイアウト生成
// B列（氏名）: 175px -> 指示6で「字がつぶれない範囲で少し狭めて」 -> 140px (width 19.3)
// 日付列: 指示4「C～AD列の幅を115ピクセルに固定」
// 集計列: 指示4「AEとAFは105ピクセルに固定、AH～AL列の幅を75ピクセルに固定」
// 行の高さ: スタッフ行「55ピクセル固定」 -> ht="41.25"
// カウンター行: 「45ピクセル固定」 -> ht="33.75"
console.log('Script loaded');
