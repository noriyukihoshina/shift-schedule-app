const fs = require('fs');

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

const sE = unzipXml('test_case_E_entityquotes.xlsx', 'xl/worksheets/sheet1.xml');
const sH = unzipXml('test_case_H_full_static.xlsx', 'xl/worksheets/sheet1.xml');

fs.writeFileSync('sheet_E.xml', sE);
fs.writeFileSync('sheet_H.xml', sH);

console.log('Saved sheet_E.xml (length ' + sE.length + ') and sheet_H.xml (length ' + sH.length + ')');
