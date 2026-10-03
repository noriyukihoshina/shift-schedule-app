$here = Get-Location
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'

# 1. Edge headless でテスト用ページを実行し、copyForExcel の HTML を抽出
$testHtml = Join-Path $here 'test_extract_html.html'
$htmlContent = @'
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<div id="output">RUNNING</div>
<textarea id="captured"></textarea>
<script src="solver.js"></script>
<script src="app.js"></script>
<script>
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        // サンプル投入して解く
        document.getElementById('solveBtn').click();
        setTimeout(() => {
            // copyForExcelのHTMLをキャプチャするため、navigator.clipboard.writeをモック
            let capturedHtml = '';
            navigator.clipboard.write = async (items) => {
                for (const item of items) {
                    if (item.types.includes('text/html')) {
                        const blob = await item.getType('text/html');
                        capturedHtml = await blob.text();
                    }
                }
                const el = document.getElementById('captured');
                el.value = capturedHtml;
                document.getElementById('output').innerText = 'DONE';
            };

            document.getElementById('copyForExcelBtn').click();
        }, 1000);
    }, 300);
});
</script>
</body>
</html>
'@

[System.IO.File]::WriteAllText($testHtml, $htmlContent, [System.Text.Encoding]::UTF8)

$dumpOut = Join-Path $here 'temp_dump_copy.txt'
& $edge --headless --virtual-time-budget=5000 --dump-dom $testHtml | Out-File -Encoding utf8 $dumpOut

$dump = [System.IO.File]::ReadAllText($dumpOut, [System.Text.Encoding]::UTF8)
if ($dump -match '<textarea id="captured">(.*?)</textarea>') {
    Add-Type -AssemblyName System.Web
    $rawHtml = [System.Web.HttpUtility]::HtmlDecode($matches[1])
    $clipHtmlFile = Join-Path $here 'temp_pasted_table.html'
    [System.IO.File]::WriteAllText($clipHtmlFile, $rawHtml, [System.Text.Encoding]::UTF8)
    Write-Output ("HTML captured successfully! Length: " + $rawHtml.Length)

    # Excel COMでHTMLを開いて内容を検証
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $wb = $excel.Workbooks.Open($clipHtmlFile)
    $sheet = $wb.Sheets.Item(1)

    Write-Output "=== Excel Verification for copyForExcel ==="
    Write-Output ("Row 4 (Staff 2 No 2): B4=" + $sheet.Range("B4").Text)
    Write-Output ("AE4 (Work):  Value2=" + $sheet.Range("AE4").Value2 + ", Formula=" + $sheet.Range("AE4").Formula + ", Text=" + $sheet.Range("AE4").Text)
    Write-Output ("AF4 (Off):   Value2=" + $sheet.Range("AF4").Value2 + ", Formula=" + $sheet.Range("AF4").Formula + ", Text=" + $sheet.Range("AF4").Text)
    Write-Output ("AG4 (Paid):  Value2=" + $sheet.Range("AG4").Value2 + ", Formula=" + $sheet.Range("AG4").Formula + ", Text=" + $sheet.Range("AG4").Text)
    Write-Output ("AH4 (Ref):   Value2=" + $sheet.Range("AH4").Value2 + ", Formula=" + $sheet.Range("AH4").Formula + ", Text=" + $sheet.Range("AH4").Text)
    Write-Output ("AI4 (Early): Value2=" + $sheet.Range("AI4").Value2 + ", Formula=" + $sheet.Range("AI4").Formula + ", Text=" + $sheet.Range("AI4").Text)
    Write-Output ("AJ4 (Late):  Value2=" + $sheet.Range("AJ4").Value2 + ", Formula=" + $sheet.Range("AJ4").Formula + ", Text=" + $sheet.Range("AJ4").Text)
    Write-Output ("AK4 (Eve):   Value2=" + $sheet.Range("AK4").Value2 + ", Formula=" + $sheet.Range("AK4").Formula + ", Text=" + $sheet.Range("AK4").Text)
    Write-Output ("AL4 (8h):    Value2=" + $sheet.Range("AL4").Value2 + ", Formula=" + $sheet.Range("AL4").Formula + ", Text=" + $sheet.Range("AL4").Text)

    Write-Output "--- Footer Rows Verification ---"
    Write-Output ("Row 54 (Total Work): Label=" + $sheet.Range("A54").Text + ", C54=" + $sheet.Range("C54").Text + ", Formula=" + $sheet.Range("C54").Formula)
    Write-Output ("Row 55 (Early):      Label=" + $sheet.Range("A55").Text + ", C55=" + $sheet.Range("C55").Text + ", Formula=" + $sheet.Range("C55").Formula)
    Write-Output ("Row 56 (Late):       Label=" + $sheet.Range("A56").Text + ", C56=" + $sheet.Range("C56").Text + ", Formula=" + $sheet.Range("C56").Formula)
    Write-Output ("Row 57 (Eve):        Label=" + $sheet.Range("A57").Text + ", C57=" + $sheet.Range("C57").Text + ", Formula=" + $sheet.Range("C57").Formula)
    Write-Output ("Row 58 (8h):         Label=" + $sheet.Range("A58").Text + ", C58=" + $sheet.Range("C58").Text + ", Formula=" + $sheet.Range("C58").Formula)
    Write-Output ("AE54 (Total Sum):    Value2=" + $sheet.Range("AE54").Value2 + ", Formula=" + $sheet.Range("AE54").Formula + ", Text=" + $sheet.Range("AE54").Text)

    $wb.Close($false)
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
} else {
    Write-Output "Failed to find textarea. Dump snippet:"
    Write-Output $dump.Substring(0, [Math]::Min(500, $dump.Length))
}
