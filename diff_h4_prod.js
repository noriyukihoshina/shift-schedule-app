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

const sH4 = unzipXml('test_h4_countif_footer.xlsx', 'xl/worksheets/sheet1.xml');
const sProd = unzipXml('test_final_production.xlsx', 'xl/worksheets/sheet1.xml');

console.log('sH4 length:', sH4.length);
console.log('sProd length:', sProd.length);

const stylesH4 = unzipXml('test_h4_countif_footer.xlsx', 'xl/styles.xml');
const stylesProd = unzipXml('test_final_production.xlsx', 'xl/styles.xml');
console.log('styles equal?:', stylesH4 === stylesProd);

// H4 にあって Prod にないもの、またはその逆
// H4 の footer:
console.log('H4 footer rows:');
const h4Rows = sH4.match(/<row r="(?:5[2-9]|6[0-9])"[\s\S]*?<\/row>/g);
console.log(h4Rows);

console.log('Prod footer rows:');
const prodRows = sProd.match(/<row r="(?:5[2-9]|6[0-9])"[\s\S]*?<\/row>/g);
console.log('Prod has', prodRows ? prodRows.length : 0, 'footer rows');
