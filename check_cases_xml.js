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

const cases = ['A_minimal', 'B_cols', 'C_pagesetup', 'D_rawquotes', 'E_entityquotes', 'F_footer_raw', 'G_footer_entity'];

cases.forEach(c => {
    const fn = `test_case_${c}.xlsx`;
    const s = unzipXml(fn, 'xl/worksheets/sheet1.xml');
    console.log(`\n=== ${fn} (len: ${s.length}) ===`);
    // print last 300 chars
    console.log(s.substring(s.length - 300));
});
