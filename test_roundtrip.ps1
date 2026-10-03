$here = Get-Location
$xlsxPath = Join-Path $here "verified_blank_template.xlsx"
$userSavedPath = Join-Path $here "staff_filled_sample.xlsx"

# 1. Excel COMで実際にスタッフが希望を入力して保存するシミュレーション
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Open($xlsxPath)
$sheet = $wb.Sheets.Item(1)

# スタッフ1 (L3: 4/1, M3: 4/2)
$sheet.Range("L3").Value2 = "休"
$sheet.Range("M3").Value2 = "有"
# スタッフ2 (Q4: 4/6)
$sheet.Range("Q4").Value2 = "早"
# スタッフ3 (V5: 4/11)
$sheet.Range("V5").Value2 = "○/休"
# スタッフ4 (AA6: 4/16)
$sheet.Range("AA6").Value2 = "上1"

$wb.SaveAs($userSavedPath)
$wb.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
Write-Output "Excel COM: Simulated staff filled input and saved to $userSavedPath"

# 2. このExcelが保存したネイティブXLSXファイルをBase64にしてブラウザ側パーサーに渡す
$bytes = [System.IO.File]::ReadAllBytes($userSavedPath)
$b64 = [Convert]::ToBase64String($bytes)

# HTMLテストページを作成
$testHtml = @"
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<div id="res">PARSING...</div>
<script>
// DecompressionStream and parseXlsxBuffer
async function parseXlsxBuffer(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    const view = new DataView(bytes.buffer);
    const textDecoder = new TextDecoder();
    const entries = {};

    let pos = 0;
    while (pos < bytes.length - 4) {
        const sig = view.getUint32(pos, true);
        if (sig === 0x04034b50) {
            const method = view.getUint16(pos + 8, true);
            const compSize = view.getUint32(pos + 18, true);
            const nameLen = view.getUint16(pos + 26, true);
            const extraLen = view.getUint16(pos + 28, true);
            const name = textDecoder.decode(bytes.subarray(pos + 30, pos + 30 + nameLen));
            const dataStart = pos + 30 + nameLen + extraLen;
            const compData = bytes.subarray(dataStart, dataStart + compSize);

            let decompData = null;
            if (method === 0) {
                decompData = compData;
            } else if (method === 8) {
                if (typeof DecompressionStream !== 'undefined') {
                    const ds = new DecompressionStream('deflate-raw');
                    const writer = ds.writable.getWriter();
                    writer.write(compData);
                    writer.close();
                    const reader = ds.readable.getReader();
                    const chunks = [];
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        chunks.push(value);
                    }
                    const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
                    decompData = new Uint8Array(totalLen);
                    let off = 0;
                    for (const c of chunks) {
                        decompData.set(c, off);
                        off += c.length;
                    }
                }
            }

            if (decompData) {
                entries[name] = textDecoder.decode(decompData);
            }
            pos = dataStart + compSize;
        } else {
            pos++;
        }
    }

    const sharedStrings = [];
    if (entries['xl/sharedStrings.xml']) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(entries['xl/sharedStrings.xml'], 'text/xml');
        const siNodes = xmlDoc.getElementsByTagName('si');
        for (let i = 0; i < siNodes.length; i++) {
            const si = siNodes[i];
            const tNodes = si.getElementsByTagName('t');
            let str = '';
            for (let j = 0; j < tNodes.length; j++) str += tNodes[j].textContent;
            sharedStrings.push(str);
        }
    }

    const items = [];
    const sheetXml = entries['xl/worksheets/sheet1.xml'];
    if (!sheetXml) throw new Error('sheet1.xml not found');

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(sheetXml, 'text/xml');
    const cNodes = xmlDoc.getElementsByTagName('c');

    for (let i = 0; i < cNodes.length; i++) {
        const c = cNodes[i];
        const ref = c.getAttribute('r');
        if (!ref) continue;

        const m = ref.match(/^([A-Z]+)([0-9]+)$/);
        if (!m) continue;

        const colStr = m[1];
        const row = parseInt(m[2], 10);
        let col = 0;
        for (let k = 0; k < colStr.length; k++) {
            col = col * 26 + (colStr.charCodeAt(k) - 64);
        }

        if (row >= 3 && row <= 52 && col >= 12 && col <= 39) {
            const t = c.getAttribute('t');
            let val = '';
            if (t === 's') {
                const vNode = c.getElementsByTagName('v')[0];
                if (vNode) {
                    const idx = parseInt(vNode.textContent, 10);
                    val = sharedStrings[idx] || '';
                }
            } else if (t === 'inlineStr') {
                const isNode = c.getElementsByTagName('is')[0];
                if (isNode) {
                    const tNodes = isNode.getElementsByTagName('t');
                    for (let j = 0; j < tNodes.length; j++) val += tNodes[j].textContent;
                }
            } else {
                const vNode = c.getElementsByTagName('v')[0];
                if (vNode) val = vNode.textContent;
            }

            if (val && val.trim() !== '') {
                items.push({
                    staffIdx: row - 3,
                    dayIdx: col - 12,
                    symbol: val.trim()
                });
            }
        }
    }
    return items;
}

async function run() {
    try {
        const b64 = "$b64";
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        const items = await parseXlsxBuffer(bytes.buffer);
        document.getElementById('res').innerText = 'IMPORT_SUCCESS: count=' + items.length + ', data=' + JSON.stringify(items);
    } catch (err) {
        document.getElementById('res').innerText = 'ERR: ' + err.message;
    }
}
run();
</script>
</body>
</html>
"@

$roundtripHtml = Join-Path $here "test_roundtrip.html"
[System.IO.File]::WriteAllText($roundtripHtml, $testHtml, [System.Text.Encoding]::UTF8)

$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$uniqueId = [Guid]::NewGuid().ToString("N")
$outFile = Join-Path $here ("temp_roundtrip_" + $uniqueId + ".txt")

& $edge --headless --dump-dom $roundtripHtml | Out-File -Encoding utf8 $outFile
$res = [System.IO.File]::ReadAllText($outFile, [System.Text.Encoding]::UTF8)

if ($res -match 'IMPORT_SUCCESS: (.*?)</div>') {
    Write-Output "Excel Roundtrip Import Test: 100% PASS!"
    Write-Output "Parsed Data: $($matches[1])"
} else {
    Write-Output "Roundtrip Test Failed: $res"
}
