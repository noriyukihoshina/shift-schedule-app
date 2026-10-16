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
const list = [];
while ((m = formulaRegex.exec(sBad)) !== null) {
    list.push({ cell: m[1], formula: m[2] });
}
console.log('Total formula cells in sBad:', list.length);

// セル行の種類ごとに1つずつサンプル表示
const samples = {};
list.forEach(item => {
    const col = item.cell.replace(/[0-9]/g, '');
    const row = parseInt(item.cell.replace(/[^0-9]/g, ''));
    let type = 'staff';
    if (row > 51) type = 'footer_' + row;
    const key = type + '_' + col;
    if (!samples[key]) samples[key] = item.formula;
});

console.log('Sample formulas by section/type:');
for (const [k, v] of Object.entries(samples)) {
    console.log(k, ':', v);
}
