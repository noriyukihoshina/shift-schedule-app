$here = Get-Location
$htmlFile = Join-Path $here "test_formula_cells.html"

# Create HTML table with formula
$html = @"
<html>
<head><meta charset="utf-8"></head>
<body>
<table>
  <tr>
    <td>10</td>
    <td>20</td>
    <td>=A1+B1</td>
    <td x:f="=A1+B1">30</td>
  </tr>
</table>
</body>
</html>
"@
[System.IO.File]::WriteAllText($htmlFile, $html, [System.Text.Encoding]::UTF8)

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Open($htmlFile)
$sheet = $wb.Sheets.Item(1)

$c1 = $sheet.Range("C1")
$d1 = $sheet.Range("D1")

Write-Output "C1 (without x:f): Value=$($c1.Value2), Formula=$($c1.Formula), Text=$($c1.Text)"
Write-Output "D1 (with x:f):    Value=$($d1.Value2), Formula=$($d1.Formula), Text=$($d1.Text)"

$wb.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
