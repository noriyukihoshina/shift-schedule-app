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

const sH2 = unzipXml('test_h2_staff48_formulas.xlsx', 'xl/worksheets/sheet1.xml');
const sH3 = unzipXml('test_h3_simple_footer.xlsx', 'xl/worksheets/sheet1.xml');

// どこが違うか差分を検索
console.log('sH2 len:', sH2.length, 'sH3 len:', sH3.length);
// sH3 は sH2 に replace で行52を追加したもののはず
const diffIndex = sH3.indexOf('<row r="52">');
console.log('diffIndex:', diffIndex);
console.log('sH2 from diffIndex:', sH2.substring(diffIndex - 50));
console.log('sH3 from diffIndex:', sH3.substring(diffIndex - 50));
