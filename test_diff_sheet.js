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

console.log('--- OK styles.xml ---');
console.log(okEntries['xl/styles.xml']);

console.log('--- NG styles.xml ---');
console.log(ngEntries['xl/styles.xml']);

console.log('--- OK sheet1.xml (first 500 chars) ---');
console.log(okEntries['xl/worksheets/sheet1.xml'].substring(0, 500));
console.log('--- OK sheet1.xml (last 500 chars) ---');
console.log(okEntries['xl/worksheets/sheet1.xml'].substring(okEntries['xl/worksheets/sheet1.xml'].length - 500));

console.log('--- NG sheet1.xml (first 500 chars) ---');
console.log(ngEntries['xl/worksheets/sheet1.xml'].substring(0, 500));
console.log('--- NG sheet1.xml (last 500 chars) ---');
console.log(ngEntries['xl/worksheets/sheet1.xml'].substring(ngEntries['xl/worksheets/sheet1.xml'].length - 500));
