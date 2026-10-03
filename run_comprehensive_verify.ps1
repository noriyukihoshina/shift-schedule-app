$here = Get-Location
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'

$testHtml = Join-Path $here 'test_verify_comprehensive.html'
$dumpOut = Join-Path $here 'temp_dump_comprehensive.txt'

Write-Output "Step 1: Running Edge Headless..."
& $edge --headless --virtual-time-budget=5000 --dump-dom $testHtml | Out-File -Encoding utf8 $dumpOut

$dump = [System.IO.File]::ReadAllText($dumpOut, [System.Text.Encoding]::UTF8)

if ($dump -notmatch 'id="test-status">SUCCESS_GENERATE<') {
    Write-Output "Generation failed. Dump snippet:"
    Write-Output $dump.Substring(0, [Math]::Min(1000, $dump.Length))
    exit 1
}
Write-Output "Step 1 Passed: Both Blank XLSX and Copy HTML successfully generated in JS!"

# 1. Blank XLSX 検証
if ($dump -match '<div id="xlsx-b64">(.*?)</div>') {
    $b64 = $matches[1]
    $xlsxBytes = [Convert]::FromBase64String($b64)
    $blankXlsxPath = Join-Path $here 'verified_staff_blank_template.xlsx'
    [System.IO.File]::WriteAllBytes($blankXlsxPath, $xlsxBytes)
    Write-Output "Step 2: Blank XLSX saved: $blankXlsxPath ($($xlsxBytes.Length) bytes)"

    # Excel COM Verification for Blank XLSX
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false

    try {
        $wb = $excel.Workbooks.Open($blankXlsxPath)
        $ws = $wb.Sheets.Item(1)

        Write-Output "=== 1. スタッフ入力用 空白勤務表 (.xlsx) 検証 ==="
        Write-Output ("Sheet Name: " + $ws.Name)
        Write-Output ("A1 (Title): " + $ws.Range("A1").Text)
        Write-Output ("A2 (No):    " + $ws.Range("A2").Text)
        Write-Output ("B2 (氏名):  " + $ws.Range("B2").Text)
        Write-Output ("C2 (2行目初日日付・曜日なし): " + $ws.Range("C2").Text)
        Write-Output ("AD2 (2行目最終日日付):        " + $ws.Range("AD2").Text)
        Write-Output ("AE2 (希望休数ヘッダー):       " + $ws.Range("AE2").Text)
        Write-Output ("AF2 (希望有休数ヘッダー):     " + $ws.Range("AF2").Text)
        Write-Output ("AG2 (備考ヘッダー):           " + $ws.Range("AG2").Text)
        Write-Output ("C3 (3行目初日曜日のみ):       " + $ws.Range("C3").Text)
        Write-Output ("AD3 (3行目最終日曜日のみ):     " + $ws.Range("AD3").Text)

        Write-Output ("Staff 1 Row 4: A4=" + $ws.Range("A4").Text + ", B4=" + $ws.Range("B4").Text + ", C4 (希望欄空欄確認)='" + $ws.Range("C4").Text + "'")
        Write-Output ("Staff 2 Row 5: A5=" + $ws.Range("A5").Text + ", B5=" + $ws.Range("B5").Text + ", C5 (希望欄空欄確認)='" + $ws.Range("C5").Text + "'")
        Write-Output ("Staff 50 Row 53: A53=" + $ws.Range("A53").Text + ", B53=" + $ws.Range("B53").Text + ", AD53='" + $ws.Range("AD53").Text + "'")

        Write-Output ("AE4 Formula: " + $ws.Range("AE4").Formula)
        Write-Output ("AF4 Formula: " + $ws.Range("AF4").Formula)

        $valC4 = $ws.Range("C4").Validation
        $valAD53 = $ws.Range("AD53").Validation
        Write-Output ("Validation C4:   Type=" + $valC4.Type + ", Formula1=" + $valC4.Formula1)
        Write-Output ("Validation AD53: Type=" + $valAD53.Type + ", Formula1=" + $valAD53.Formula1)

        $wb.Close($false)
    } catch {
        Write-Output ("Blank XLSX COM Error: " + $_)
    }
}

# 2. Copy For Excel HTML 検証
if ($dump -match '<div id="copy-html">(.*?)</div>') {
    Add-Type -AssemblyName System.Web
    $copyHtmlRaw = [System.Web.HttpUtility]::HtmlDecode($matches[1])
    $clipHtmlFile = Join-Path $here 'verified_copy_for_excel.html'
    [System.IO.File]::WriteAllText($clipHtmlFile, $copyHtmlRaw, [System.Text.Encoding]::UTF8)
    Write-Output "Step 3: Copy HTML saved: $clipHtmlFile ($($copyHtmlRaw.Length) chars)"

    try {
        $wb2 = $excel.Workbooks.Open($clipHtmlFile)
        $ws2 = $wb2.Sheets.Item(1)

        Write-Output "=== 2. Excelへ一発貼り付け用コピー 検証 ==="
        Write-Output ("Staff 1 Row 3: A3=" + $ws2.Range("A3").Text + ", B3=" + $ws2.Range("B3").Text)
        Write-Output ("Staff 2 Row 4: A4=" + $ws2.Range("A4").Text + ", B4=" + $ws2.Range("B4").Text)

        # AE4〜AL4 のカウント・数式確認
        Write-Output ("--- AE4〜AL4 カウント確認 (Staff 2) ---")
        Write-Output ("AE4 (出勤): Value2=" + $ws2.Range("AE4").Value2 + ", Formula=" + $ws2.Range("AE4").Formula + ", Text=" + $ws2.Range("AE4").Text)
        Write-Output ("AF4 (公休): Value2=" + $ws2.Range("AF4").Value2 + ", Formula=" + $ws2.Range("AF4").Formula + ", Text=" + $ws2.Range("AF4").Text)
        Write-Output ("AG4 (有休): Value2=" + $ws2.Range("AG4").Value2 + ", Formula=" + $ws2.Range("AG4").Formula + ", Text=" + $ws2.Range("AG4").Text)
        Write-Output ("AH4 (リフ): Value2=" + $ws2.Range("AH4").Value2 + ", Formula=" + $ws2.Range("AH4").Formula + ", Text=" + $ws2.Range("AH4").Text)
        Write-Output ("AI4 (早番): Value2=" + $ws2.Range("AI4").Value2 + ", Formula=" + $ws2.Range("AI4").Formula + ", Text=" + $ws2.Range("AI4").Text)
        Write-Output ("AJ4 (遅番): Value2=" + $ws2.Range("AJ4").Value2 + ", Formula=" + $ws2.Range("AJ4").Formula + ", Text=" + $ws2.Range("AJ4").Text)
        Write-Output ("AK4 (E):    Value2=" + $ws2.Range("AK4").Value2 + ", Formula=" + $ws2.Range("AK4").Formula + ", Text=" + $ws2.Range("AK4").Text)
        Write-Output ("AL4 (8時):  Value2=" + $ws2.Range("AL4").Value2 + ", Formula=" + $ws2.Range("AL4").Formula + ", Text=" + $ws2.Range("AL4").Text)

        # 54〜58行目の独立確認
        Write-Output ("--- 54〜58行目 独立フッター確認 ---")
        Write-Output ("Row 54: Label=" + $ws2.Range("A54").Text + ", C54=" + $ws2.Range("C54").Text + ", C54 Formula=" + $ws2.Range("C54").Formula + ", AE54(合計)=" + $ws2.Range("AE54").Text)
        Write-Output ("Row 55: Label=" + $ws2.Range("A55").Text + ", C55=" + $ws2.Range("C55").Text + ", C55 Formula=" + $ws2.Range("C55").Formula)
        Write-Output ("Row 56: Label=" + $ws2.Range("A56").Text + ", C56=" + $ws2.Range("C56").Text + ", C56 Formula=" + $ws2.Range("C56").Formula)
        Write-Output ("Row 57: Label=" + $ws2.Range("A57").Text + ", C57=" + $ws2.Range("C57").Text + ", C57 Formula=" + $ws2.Range("C57").Formula)
        Write-Output ("Row 58: Label=" + $ws2.Range("A58").Text + ", C58=" + $ws2.Range("C58").Text + ", C58 Formula=" + $ws2.Range("C58").Formula)

        $wb2.Close($false)
    } catch {
        Write-Output ("Copy HTML COM Error: " + $_)
    }
}

$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
Write-Output ">>> ALL VERIFICATION TASKS COMPLETED! <<<"
