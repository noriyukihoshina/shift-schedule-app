const fs = require('fs');

function unzipEntries(fname) {
    const buf = fs.readFileSync(fname);
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
            entries[name] = buf.subarray(dataStart, dataStart + compSize);
            pos = dataStart + compSize;
        } else break;
    }
    return entries;
}

const ok = unzipEntries('test_prod_with_all_styles.xlsx');
const app = unzipEntries('test_from_appjs.xlsx');

function clean(s) {
    return s.replace(/<!--[\s\S]*?-->/g, '').split('\n').map(l => l.trim()).filter(l => l.length > 0);
}

// 1. 各ファイルのエントリ名比較
console.log('--- ZIP ENTRIES ---');
for (let k of Object.keys(ok)) {
    console.log(k, 'ok len:', ok[k].length, 'app len:', app[k] ? app[k].length : 'missing');
}

// 2. styles.xml 比較
console.log('--- STYLES.XML ---');
const okSt = ok['xl/styles.xml'].toString('utf8');
const appSt = app['xl/styles.xml'].toString('utf8');
console.log('styles exact match?:', okSt === appSt);
if (okSt !== appSt) {
    const okStL = clean(okSt);
    const appStL = clean(appSt);
    for (let i = 0; i < Math.max(okStL.length, appStL.length); i++) {
        if (okStL[i] !== appStL[i]) {
            console.log('styles diff ' + i + ':');
            console.log('  OK:  [' + okStL[i] + ']');
            console.log('  APP: [' + appStL[i] + ']');
        }
    }
}

// 3. フッター行比較
console.log('--- SHEET1 FOOTER ---');
const okL = clean(ok['xl/worksheets/sheet1.xml'].toString('utf8'));
const appL = clean(app['xl/worksheets/sheet1.xml'].toString('utf8'));
const okIdx = okL.findIndex(l => l.indexOf('r="52"') !== -1);
const appIdx = appL.findIndex(l => l.indexOf('r="52"') !== -1);
console.log('okIdx:', okIdx, 'appIdx:', appIdx);
const okFooter = okL.slice(okIdx);
const appFooter = appL.slice(appIdx);
console.log('Footer count: ok=' + okFooter.length + ', app=' + appFooter.length);
for (let i = 0; i < Math.max(okFooter.length, appFooter.length); i++) {
    if (okFooter[i] !== appFooter[i]) {
        console.log('Footer diff ' + i + ':');
        console.log('  OK:  [' + okFooter[i] + ']');
        console.log('  APP: [' + appFooter[i] + ']');
    }
}

console.log('--- ALL DIFFERENCES BETWEEN OK AND APP ---');
let diffTotal = 0;
for (let i = 0; i < Math.max(okL.length, appL.length); i++) {
    if (okL[i] !== appL[i]) {
        diffTotal++;
        if (diffTotal <= 20) {
            console.log('Diff ' + diffTotal + ' at line ' + (i+1) + ':');
            console.log('  OK:  [' + okL[i] + ']');
            console.log('  APP: [' + appL[i] + ']');
        }
    }
}
console.log('Total diff count: ' + diffTotal);


