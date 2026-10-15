// verify_excel_both_terms.js
const fs = require('fs');

function crc32(buf) {
    let table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[i] = c;
    }
    let crc = 0 ^ (-1);
    for (let i = 0; i < buf.length; i++) {
        crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
    }
    return (crc ^ (-1)) >>> 0;
}

function createZipUint8Array(files) {
    const encoder = new TextEncoder();
    const fileEntries = [];
    let localOffset = 0;

    for (const f of files) {
        const nameBytes = encoder.encode(f.name);
        const dataBytes = (typeof f.data === 'string') ? encoder.encode(f.data) : f.data;
        const crc = crc32(dataBytes);
        const compSize = dataBytes.length;
        const uncompSize = dataBytes.length;

        const localHeader = new Uint8Array(30 + nameBytes.length);
        const lView = new DataView(localHeader.buffer);
        lView.setUint32(0, 0x04034b50, true);
        lView.setUint16(4, 20, true);
        lView.setUint16(6, 0x0800, true);
        lView.setUint16(8, 0, true);
        lView.setUint16(10, 0, true);
        lView.setUint16(12, 0, true);
        lView.setUint32(14, crc, true);
        lView.setUint32(18, compSize, true);
        lView.setUint32(22, uncompSize, true);
        lView.setUint16(26, nameBytes.length, true);
        lView.setUint16(28, 0, true);
        localHeader.set(nameBytes, 30);

        fileEntries.push({
            nameBytes,
            dataBytes,
            crc,
            compSize,
            uncompSize,
            localOffset,
            localHeader
        });

        localOffset += localHeader.length + dataBytes.length;
    }

    const cdEntries = [];
    let cdSize = 0;
    for (const e of fileEntries) {
        const cdHdr = new Uint8Array(46 + e.nameBytes.length);
        const cView = new DataView(cdHdr.buffer);
        cView.setUint32(0, 0x02014b50, true);
        cView.setUint16(4, 20, true);
        cView.setUint16(6, 20, true);
        cView.setUint16(8, 0x0800, true);
        cView.setUint16(10, 0, true);
        cView.setUint16(12, 0, true);
        cView.setUint16(14, 0, true);
        cView.setUint32(16, e.crc, true);
        cView.setUint32(20, e.compSize, true);
        cView.setUint32(24, e.uncompSize, true);
        lView_cdHdr: {
            // ...
        }
        cView.setUint16(28, e.nameBytes.length, true);
        cView.setUint16(30, 0, true);
        cView.setUint16(32, 0, true);
        cView.setUint16(34, 0, true);
        cView.setUint16(36, 0, true);
        cView.setUint32(38, 0, true);
        cView.setUint32(42, e.localOffset, true);
        cdHdr.set(e.nameBytes, 46);

        cdEntries.push(cdHdr);
        cdSize += cdHdr.length;
    }

    const eocd = new Uint8Array(22);
    const eView = new DataView(eocd.buffer);
    eView.setUint32(0, 0x06054b50, true);
    eView.setUint16(4, 0, true);
    eView.setUint16(6, 0, true);
    eView.setUint16(8, fileEntries.length, true);
    eView.setUint16(10, fileEntries.length, true);
    eView.setUint32(12, cdSize, true);
    eView.setUint32(16, localOffset, true);
    eView.setUint16(20, 0, true);

    const totalLen = localOffset + cdSize + 22;
    const result = new Uint8Array(totalLen);
    let cur = 0;
    for (const e of fileEntries) {
        result.set(e.localHeader, cur);
        cur += e.localHeader.length;
        result.set(e.dataBytes, cur);
        cur += e.dataBytes.length;
    }
    for (const c of cdEntries) {
        result.set(c, cur);
        cur += c.length;
    }
    result.set(eocd, cur);
    return result;
}

function toColLetter(c) {
    let s = '';
    while (c > 0) {
        let m = (c - 1) % 26;
        s = String.fromCharCode(65 + m) + s;
        c = Math.floor((c - m) / 26);
    }
    return s;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

function generateMockTerm(startYear, startMonth, startDay, numDays) {
    const dates = [];
    let cur = new Date(startYear, startMonth - 1, startDay);
    for (let d = 0; d < numDays; d++) {
        const dt = new Date(cur);
        dt.setDate(cur.getDate() + d);
        dates.push({
            m: dt.getMonth() + 1,
            day: dt.getDate(),
            w: WEEKDAYS[dt.getDay()],
            wIdx: dt.getDay(),
            weekday: WEEKDAYS[dt.getDay()],
            label: `${dt.getMonth() + 1}/${dt.getDate()}`
        });
    }
    return {
        first: dates[0],
        last: dates[dates.length - 1],
        dates
    };
}

const NUM_STAFF = 30;
const staffList = [];
for (let i = 0; i < NUM_STAFF; i++) {
    staffList.push({
        name: `スタッフ ${String(i + 1).padStart(2, '0')}`,
        section: i < 15 ? 'A' : 'B',
        isFullTime: i < 10,
        remarks: i === 0 ? '安全衛生委員会' : ''
    });
}

// app.js から exportExcelSpreadsheet と downloadBlankXlsx を抽出
const appCode = fs.readFileSync('app.js', 'utf8');

// テスト関数実行ラッパー
function runExportTest(termObj, outFileName) {
    let globalTerm = termObj;
    function getTermInfo() { return globalTerm; }
    const dayOffsets = new Array(termObj.dates.length).fill(0);

    const grid = [];
    for (let s = 0; s < NUM_STAFF; s++) {
        const row = [];
        for (let d = 0; d < termObj.dates.length; d++) {
            row.push({
                symbol: (d % 7 === 0 || d % 7 === 6) ? '休' : '○',
                isFixed: (s === 0 && d === 1)
            });
        }
        grid.push(row);
    }

    const fnStart = appCode.indexOf('function exportExcelSpreadsheet(grid, stats)');
    const nextFn = appCode.indexOf('\n    // 初期起動', fnStart);
    let fnBody = appCode.substring(fnStart, nextFn);

    fnBody = fnBody.replace(/const zipBuf = createZipUint8Array\(files\);[\s\S]*?showToast\([^)]*\);/m, `
        const zipBuf = createZipUint8Array(files);
        fs.writeFileSync('${outFileName}', Buffer.from(zipBuf));
        console.log('Saved ${outFileName}');
    `);

    eval(fnBody);
    exportExcelSpreadsheet(grid, {});
}

function runBlankTest(termObj, outFileName) {
    let globalTerm = termObj;
    function getTermInfo() { return globalTerm; }

    const fnStart = appCode.indexOf('function downloadBlankXlsx()');
    const nextFn = appCode.indexOf('\n    function normalizeSymbol', fnStart);
    let fnBody = appCode.substring(fnStart, nextFn);

    fnBody = fnBody.replace(/const zipBuf = createZipUint8Array\(files\);[\s\S]*?showToast\([^)]*\);/m, `
        const zipBuf = createZipUint8Array(files);
        fs.writeFileSync('${outFileName}', Buffer.from(zipBuf));
        console.log('Saved ${outFileName}');
    `);

    eval(fnBody);
    downloadBlankXlsx();
}

console.log('--- Generating 28-day files ---');
const term28 = generateMockTerm(2026, 4, 1, 28);
runBlankTest(term28, 'test_term28_blank.xlsx');
runExportTest(term28, 'test_term28_export.xlsx');

console.log('--- Generating 29-day files (Term 13) ---');
const term29 = generateMockTerm(2027, 3, 3, 29);
runBlankTest(term29, 'test_term29_blank.xlsx');
runExportTest(term29, 'test_term29_export.xlsx');

console.log('Generation completed.');
