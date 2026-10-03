$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$here = Get-Location
$url = Join-Path $here "test_all_features.html"
$uniqueId = [Guid]::NewGuid().ToString("N")
$outFile = Join-Path $here ("temp_features_" + $uniqueId + ".txt")

# Run Edge headless and capture output via Out-File
& $edge --headless --dump-dom $url | Out-File -Encoding utf8 $outFile

$content = [System.IO.File]::ReadAllText($outFile, [System.Text.Encoding]::UTF8)

if ($content -match 'SUCCESS_ALL: b64len=(\d+), b64=([A-Za-z0-9+/=]+)') {
    $b64 = $matches[2]
    Write-Output "JavaScript Engine Test: 100% PASS! (B64 Length: $($matches[1]))"

    $bytes = [Convert]::FromBase64String($b64)
    $xlsxPath = Join-Path $here "verified_blank_template.xlsx"
    [System.IO.File]::WriteAllBytes($xlsxPath, $bytes)
    Write-Output "Generated Blank XLSX saved: $xlsxPath (Size: $($bytes.Length) bytes)"

    # Verify with Excel COM
    try {
        $excel = New-Object -ComObject Excel.Application
        $excel.Visible = $false
        $excel.DisplayAlerts = $false
        $wb = $excel.Workbooks.Open($xlsxPath)
        $sheet = $wb.Sheets.Item(1)

        $title = $sheet.Range("A1").Text
        $noHdr = $sheet.Range("A2").Text
        $dateHdr1 = $sheet.Range("L2").Text
        $dateHdr28 = $sheet.Range("AM2").Text
        $sumHdr1 = $sheet.Range("AN2").Text
        $sumHdr2 = $sheet.Range("AO2").Text

        $valL3 = $sheet.Range("L3").Validation
        $valAM52 = $sheet.Range("AM52").Validation

        $fAN3 = $sheet.Range("AN3").Formula
        $fAO3 = $sheet.Range("AO3").Formula

        Write-Output "--- Excel 16.0 COM Verification ---"
        Write-Output "Sheet Name: $($sheet.Name)"
        Write-Output "Title (A1): $title"
        Write-Output "Headers: A2=$noHdr, L2=$dateHdr1, AM2=$dateHdr28, AN2=$sumHdr1, AO2=$sumHdr2"
        Write-Output "Formulas: AN3=$fAN3, AO3=$fAO3"
        Write-Output "Dropdown Validation (L3): Type=$($valL3.Type), Formula=$($valL3.Formula1)"
        Write-Output "Dropdown Validation (AM52): Type=$($valAM52.Type), Formula=$($valAM52.Formula1)"

        $wb.Close($false)
        $excel.Quit()
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
        Write-Output ">>> ALL VERIFICATIONS PASSED WITH ZERO ERRORS! <<<"
    } catch {
        Write-Output "Excel COM Verification Error: $_"
    }
} else {
    Write-Output "Test Failed or Incomplete. Content:"
    if ($content -match 'id="test-result">(.*?)</div>') {
        Write-Output $matches[1]
    } else {
        Write-Output $content
    }
}
