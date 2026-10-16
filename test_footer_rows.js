const fs = require('fs');

function unzipSheet1(fname) {
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
            if (name === 'xl/worksheets/sheet1.xml') {
                return buf.toString('utf8', dataStart, dataStart + compSize);
            }
            pos = dataStart + compSize;
        } else break;
    }
    return null;
}

const sBad = unzipSheet1('test_export_generated.xlsx');

const formulaRegex = /<c r="([A-Z0-9]+)"[^>]*><f>([\s\S]*?)<\/f>/g;
let m;
const byRow = {};
while ((m = formulaRegex.exec(sBad)) !== null) {
    const cell = m[1];
    const row = parseInt(cell.replace(/[^0-9]/g, ''));
    if (!byRow[row]) byRow[row] = {};
    const col = cell.replace(/[0-9]/g, '');
    byRow[row][col] = m[2];
}

for (const r of Object.keys(byRow)) {
    if (parseInt(r) >= 51) {
        console.log(`\n=== ROW ${r} ===`);
        const cols = Object.keys(byRow[r]);
        console.log(`Cols count: ${cols.length}`);
        console.log(`Sample B${r}:`, byRow[r]['B']);
        console.log(`Sample AD${r}:`, byRow[r]['AD']);
    }
}
