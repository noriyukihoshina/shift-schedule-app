const fs = require('fs');

// app.js から exportExcelSpreadsheet と周辺のコードを読み込んで実行テスト
// 48名のスタッフデータと模擬グリッドを用意し、app.js と全く同じ XML 生成ロジックで test_from_appjs.xlsx を生成する。

function calcZipCrc32(bytes) {
    let crc = 0xFFFFFFFF;
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        table[i] = c;
    }
    for (let i = 0; i < bytes.length; i++) crc = table[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function createZipUint8Array(files) {
    const textEncoder = new TextEncoder();
    const fileEntries = files.map(f => {
        const nameBytes = textEncoder.encode(f.name);
        const dataBytes = (typeof f.data === 'string') ? textEncoder.encode(f.data) : (f.data instanceof Uint8Array ? f.data : Buffer.from(f.data));
        return {
            name: f.name,
            nameBytes,
            dataBytes,
            crc: calcZipCrc32(dataBytes),
            size: dataBytes.length
        };
    });

    let localHeadersSize = 0;
    fileEntries.forEach(f => {
        f.offset = localHeadersSize;
        localHeadersSize += 30 + f.nameBytes.length + f.size;
    });

    let centralDirSize = 0;
    fileEntries.forEach(f => {
        centralDirSize += 46 + f.nameBytes.length;
    });

    const totalSize = localHeadersSize + centralDirSize + 22;
    const buf = new Uint8Array(totalSize);
    const view = new DataView(buf.buffer);
    let pos = 0;

    fileEntries.forEach(f => {
        view.setUint32(pos, 0x04034b50, true); pos += 4;
        view.setUint16(pos, 20, true); pos += 2;
        view.setUint16(pos, 0x0800, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint16(pos, 0x4a21, true); pos += 2;
        view.setUint16(pos, 0x5894, true); pos += 2;
        view.setUint32(pos, f.crc, true); pos += 4;
        view.setUint32(pos, f.size, true); pos += 4;
        view.setUint32(pos, f.size, true); pos += 4;
        view.setUint16(pos, f.nameBytes.length, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        buf.set(f.nameBytes, pos); pos += f.nameBytes.length;
        buf.set(f.dataBytes, pos); pos += f.size;
    });

    const cdOffset = pos;
    fileEntries.forEach(f => {
        view.setUint32(pos, 0x02014b50, true); pos += 4;
        view.setUint16(pos, 20, true); pos += 2;
        view.setUint16(pos, 20, true); pos += 2;
        view.setUint16(pos, 0x0800, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint16(pos, 0x4a21, true); pos += 2;
        view.setUint16(pos, 0x5894, true); pos += 2;
        view.setUint32(pos, f.crc, true); pos += 4;
        view.setUint32(pos, f.size, true); pos += 4;
        view.setUint32(pos, f.size, true); pos += 4;
        view.setUint16(pos, f.nameBytes.length, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint16(pos, 0, true); pos += 2;
        view.setUint32(pos, 0, true); pos += 4;
        view.setUint32(pos, f.offset, true); pos += 4;
        buf.set(f.nameBytes, pos); pos += f.nameBytes.length;
    });

    view.setUint32(pos, 0x06054b50, true); pos += 4;
    view.setUint16(pos, 0, true); pos += 2;
    view.setUint16(pos, 0, true); pos += 2;
    view.setUint16(pos, fileEntries.length, true); pos += 2;
    view.setUint16(pos, fileEntries.length, true); pos += 2;
    view.setUint32(pos, centralDirSize, true); pos += 4;
    view.setUint32(pos, cdOffset, true); pos += 4;
    view.setUint16(pos, 0, true); pos += 2;

    return buf;
}

function toColLetter(colIdx) {
    let temp = colIdx;
    let letter = '';
    while (temp > 0) {
        let rem = (temp - 1) % 26;
        letter = String.fromCharCode(65 + rem) + letter;
        temp = Math.floor((temp - 1) / 26);
    }
    return letter;
}

// 模擬スタッフデータ (48名)
const staffList = [];
for (let i = 1; i <= 48; i++) {
    let sec = 'PT A';
    if (i > 10 && i <= 20) sec = 'OT A';
    else if (i > 20 && i <= 30) sec = 'PT B';
    else if (i > 30 && i <= 40) sec = 'OT B';
    else if (i > 40) sec = 'ST';
    staffList.push({ name: `スタッフ${i}`, section: sec, isUnused: false });
}

const term = {
    title: '2026年4月勤務表',
    dates: []
};
const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
for (let d = 0; d < 28; d++) {
    const day = d + 1;
    const wIdx = (d + 3) % 7;
    term.dates.push({
        m: 4,
        day: day,
        label: `4/${day}`,
        weekday: weekdays[wIdx],
        wIdx: wIdx,
        isHoliday: (wIdx === 0)
    });
}
const NUM_DAYS = 28;
const dayOffsets = new Array(28).fill(0);
dayOffsets[3] = -2; // 土曜
dayOffsets[4] = -2; // 日曜

// 模擬グリッド（全種類の勤務・休暇記号、🔒赤字を含むリアルデータ）
const grid = [];
const sampleSymbols = ['〇', '休', '有', '上1', '下2', '早', '遅', 'E', '8時', '○/休', '有/○'];
for (let s = 0; s < 48; s++) {
    const row = [];
    for (let d = 0; d < 28; d++) {
        const sym = sampleSymbols[(s + d) % sampleSymbols.length];
        const isFixed = (s % 5 === 0 && d % 7 === 0);
        row.push({ symbol: sym, isFixed: isFixed });
    }
    grid.push(row);
}

// app.js から exportExcelSpreadsheet の内部を抽出して実行
const appCode = fs.readFileSync('app.js', 'utf8');
const fnStart = appCode.indexOf('function exportExcelSpreadsheet(grid, stats) {');
const fnEnd = appCode.indexOf('link.setAttribute(\'download\', `${term.title}.xlsx`);', fnStart);
const fnBody = appCode.substring(fnStart, fnEnd);

// exportExcelSpreadsheet のローカル実行版
function runExport() {
    // fnBody に files の定義まで含まれるようにする
    const fnEndFull = appCode.indexOf('const zipBuf = createZipUint8Array(files);', fnStart);
    const codeToRun = appCode.substring(fnStart, fnEndFull)
        .replace('function exportExcelSpreadsheet(grid, stats) {', '')
        .replace('const term = getTermInfo();', '');

    eval('(function() {\n' + codeToRun + '\nconst zipBuf = createZipUint8Array(files);\nfs.writeFileSync("test_from_appjs.xlsx", Buffer.from(zipBuf));\n})();');
    console.log('test_from_appjs.xlsx written successfully!');
}

runExport();
