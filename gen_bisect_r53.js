const fs = require('fs');

const script = `
const fs = require('fs');
const genSub = require('./test_bisect_H_sub.js');
// let's read test_h_test2_r52_full.xlsx sheet1.xml
function unzipXml(fname, target) {
    const buf = fs.readFileSync(fname);
    let pos = 0;
    while (pos < buf.length - 4) {
        const sig = buf.readUInt32LE(pos);
        if (sig === 0x04034b50) {
            const nameLen = buf.readUInt16LE(pos + 26);
            const extraLen = buf.readUInt16LE(pos + 28);
            const compSize = buf.readUInt32LE(pos + 18);
            const name = buf.toString('utf8', pos + 30, pos + 30 + nameLen);
            const dataStart = pos + 30 + nameLen + extraLen;
            if (name === target) return buf.toString('utf8', dataStart, dataStart + compSize);
            pos = dataStart + compSize;
        } else break;
    }
    return null;
}

const sR52 = unzipXml('test_h_test2_r52_full.xlsx', 'xl/worksheets/sheet1.xml');
// sR52 に row 53 を挿入する

// 候補1: 数式なし、値のみ
const r53_text = '    <row r="53"><c r="A53" s="9" t="inlineStr"><is><t>実数合計</t></is></c><c r="B53" s="9"><v>0</v></c></row>\\n  </sheetData>';
// 候補2: B53に =B52 (数式)
const r53_ref = '    <row r="53"><c r="A53" s="9" t="inlineStr"><is><t>実数合計</t></is></c><c r="B53" s="9"><f>B52</f><v>0</v></c></row>\\n  </sheetData>';
// 候補3: AD53に =SUM(B53:AC53) (横合計)
const r53_sum = '    <row r="53"><c r="A53" s="9" t="inlineStr"><is><t>実数合計</t></is></c><c r="AD53" s="9"><f>SUM(B53:AC53)</f><v>0</v></c></row>\\n  </sheetData>';

// zipFiles from test_bisect_H_sub.js
const { zipFiles, contentTypes, rels, workbook, wbRels, stData } = (function() {
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
    const ct = unzipXml('test_h_test2_r52_full.xlsx', '[Content_Types].xml');
    const r = unzipXml('test_h_test2_r52_full.xlsx', '_rels/.rels');
    const wb = unzipXml('test_h_test2_r52_full.xlsx', 'xl/workbook.xml');
    const wbr = unzipXml('test_h_test2_r52_full.xlsx', 'xl/_rels/workbook.xml.rels');
    const st = unzipXml('test_h_test2_r52_full.xlsx', 'xl/styles.xml');
    return { zipFiles, contentTypes: ct, rels: r, workbook: wb, wbRels: wbr, stData: st };
})();

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

makeFile('test_r53_text.xlsx', sR52.replace('</sheetData>', r53_text));
makeFile('test_r53_ref.xlsx', sR52.replace('</sheetData>', r53_ref));
makeFile('test_r53_sum.xlsx', sR52.replace('</sheetData>', r53_sum));

console.log('r53 tests written!');
`;

fs.writeFileSync('test_bisect_r53.js', script);
