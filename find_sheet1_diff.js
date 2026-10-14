const fs = require('fs');

function unzipXml(fname) {
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

const okStr = unzipXml('test_prod_with_all_styles.xlsx');
const appStr = unzipXml('test_from_appjs.xlsx');

const okL = okStr.split('\n');
const appL = appStr.split('\n');

console.log('ok lines:', okL.length, 'app lines:', appL.length);

function cleanLines(s) {
    return s.split('\n')
            .map(l => l.replace(/<!--[\s\S]*?-->/g, '').trim())
            .filter(l => l.length > 0);
}

const okClean = cleanLines(okStr);
const appClean = cleanLines(appStr);

console.log('clean ok lines:', okClean.length, 'clean app lines:', appClean.length);

let diffCount = 0;
for (let i = 0; i < Math.max(okClean.length, appClean.length); i++) {
    if (okClean[i] !== appClean[i]) {
        diffCount++;
        console.log(`Diff ${diffCount} at line ${i+1}:`);
        console.log(`  OK:  [${okClean[i]}]`);
        console.log(`  APP: [${appClean[i]}]`);
        if (diffCount >= 20) break;
    }
}
console.log('Total clean diffs:', diffCount);

