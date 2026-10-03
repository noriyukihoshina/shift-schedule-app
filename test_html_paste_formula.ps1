$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Add()
$sheet = $wb.Sheets.Item(1)

# クリップボードにHTMLをセットしてPaste
Add-Type -AssemblyName System.Windows.Forms
$htmlData = "<table><tr><td>=1+1</td><td>=COUNTIF(A1:B1,`"○`")</td></tr></table>"
[System.Windows.Forms.Clipboard]::SetText($htmlData, [System.Windows.Forms.TextDataFormat]::Html)

# Paste into sheet
try {
    $sheet.Paste($sheet.Range("A1"))
    $v1 = $sheet.Range("A1").Value2
    $f1 = $sheet.Range("A1").Formula
    $t1 = $sheet.Range("A1").Text
    $v2 = $sheet.Range("B1").Value2
    $f2 = $sheet.Range("B1").Formula
    $t2 = $sheet.Range("B1").Text
    Write-Output "Paste Result:"
    Write-Output "A1: Value=$v1, Formula=$f1, Text=$t2"
    Write-Output "B1: Value=$v2, Formula=$f2, Text=$t2"
} catch {
    Write-Output "Paste Error: $_"
}

$wb.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
