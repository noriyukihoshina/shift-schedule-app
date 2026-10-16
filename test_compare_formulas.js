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

const sGood = unzipSheet1('test_case_G_footer_entity.xlsx');
const sBad = unzipSheet1('test_export_generated.xlsx');

console.log('sGood length:', sGood.length);
console.log('sBad length:', sBad.length);

// どこに致命的な違いがあるか？
// sBad の中の数式をすべて抽出して表示
const formulaRegex = /<f>([\s\S]*?)<\/f>/g;
let m;
const badFormulas = new Set();
while ((m = formulaRegex.exec(sBad)) !== null) {
    badFormulas.add(m[1]);
}
console.log('Unique formulas in sBad:');
badFormulas.forEach(f => console.log('  ', f));
