$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$wb = $excel.Workbooks.Add()
$ws = $wb.Worksheets.Item(1)

# 文字コード作成
$c_25cb = [char]0x25CB # ○
$c_3007 = [char]0x3007 # 〇
$c_25ef = [char]0x25EF # ◯

$ws.Cells.Item(1, 1).Value2 = "U+25CB (White Circle)"
$ws.Cells.Item(1, 2).Value2 = [string]$c_25cb
$ws.Cells.Item(1, 2).Font.Name = "Arial"

$ws.Cells.Item(2, 1).Value2 = "U+3007 (Kanji Zero)"
$ws.Cells.Item(2, 2).Value2 = [string]$c_3007
$ws.Cells.Item(2, 2).Font.Name = "Arial"

$ws.Cells.Item(3, 1).Value2 = "U+25EF (Large Circle)"
$ws.Cells.Item(3, 2).Value2 = [string]$c_25ef
$ws.Cells.Item(3, 2).Font.Name = "Arial"

$ws.Cells.Item(4, 1).Value2 = "U+25CB in Meiryo"
$ws.Cells.Item(4, 2).Value2 = [string]$c_25cb
$ws.Cells.Item(4, 2).Font.Name = "Meiryo"

# 数式
$ws.Cells.Item(6, 1).Formula = "=COUNTIF(B1:B3, """ + [string]$c_25cb + """)"
$ws.Cells.Item(6, 2).Formula = "=COUNTIF(B1:B3, """ + [string]$c_3007 + """)"
$ws.Cells.Item(6, 3).Formula = "=COUNTIF(B1:B3, """ + [string]$c_25ef + """)"

Write-Output "B1: $($ws.Cells.Item(1, 2).Text)"
Write-Output "B2: $($ws.Cells.Item(2, 2).Text)"
Write-Output "B3: $($ws.Cells.Item(3, 2).Text)"
Write-Output "B4: $($ws.Cells.Item(4, 2).Text)"
Write-Output "Count U+25CB: $($ws.Cells.Item(6, 1).Value2)"
Write-Output "Count U+3007: $($ws.Cells.Item(6, 2).Value2)"
Write-Output "Count U+25EF: $($ws.Cells.Item(6, 3).Value2)"

$outPath = Join-Path (Get-Location).Path "test_circles_pure.xlsx"
$wb.SaveAs($outPath)
$wb.Close($false)
$excel.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
Write-Output "Saved to $outPath"
