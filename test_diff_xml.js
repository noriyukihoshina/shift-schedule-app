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
            entries[name] = buf.toString('utf8', dataStart, dataStart + compSize);
            pos = dataStart + compSize;
        } else {
            pos++;
        }
    }
    return entries;
}

const okEntries = unzipEntries(fs.readFileSync('verified_staff_blank_template.xlsx'));
const ngEntries = unzipEntries(fs.readFileSync('test_export_generated.xlsx'));

console.log('--- [Content_Types].xml diff ---');
console.log('OK:', okEntries['[Content_Types].xml']);
console.log('NG:', ngEntries['[Content_Types].xml']);

console.log('--- xl/workbook.xml diff ---');
console.log('OK:', okEntries['xl/workbook.xml']);
console.log('NG:', ngEntries['xl/workbook.xml']);

console.log('--- xl/_rels/workbook.xml.rels diff ---');
console.log('OK:', okEntries['xl/_rels/workbook.xml.rels']);
console.log('NG:', ngEntries['xl/_rels/workbook.xml.rels']);
