$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$wb = $excel.Workbooks.Add()
$ws = $wb.Worksheets.Item(1)

# セルに文字をセット
$ws.Cells.Item(1, 1).Value2 = "1. U+25CB in Arial"
$ws.Cells.Item(1, 2).Value2 = [string][char]0x25CB # ○
$ws.Cells.Item(1, 2).Font.Name = "Arial"
$ws.Cells.Item(1, 2).Font.Size = 10

$ws.Cells.Item(2, 1).Value2 = "2. U+3007 (Kanji) in Arial"
$ws.Cells.Item(2, 2).Value2 = [string][char]0x3007 # 〇
$ws.Cells.Item(2, 2).Font.Name = "Arial"
$ws.Cells.Item(2, 2).Font.Size = 10

$ws.Cells.Item(3, 1).Value2 = "3. U+25EF (Large) in Arial"
$ws.Cells.Item(3, 2).Value2 = [string][char]0x25EF # ◯
$ws.Cells.Item(3, 2).Font.Name = "Arial"
$ws.Cells.Item(3, 2).Font.Size = 10

$ws.Cells.Item(4, 1).Value2 = "4. U+25CB in Meiryo"
$ws.Cells.Item(4, 2).Value2 = [string][char]0x25CB # ○
$ws.Cells.Item(4, 2).Font.Name = "Meiryo"
$ws.Cells.Item(4, 2).Font.Size = 10

# HTML貼り付けのテスト
# クリップボード経由のHTML貼り付けをシミュレート
$testHtml = @"
<table style="border-collapse:collapse;">
  <tr>
    <td style="font-family:Meiryo; font-size:10pt;">Meiryo ○</td>
    <td style="font-family:'Meiryo'; font-size:10pt;">'Meiryo' ○</td>
    <td style="font-family:'Meiryo',sans-serif; font-size:10pt;">'Meiryo',sans-serif ○</td>
    <td style="font-size:10pt;"><font face="Meiryo">font face Meiryo ○</font></td>
    <td style="font-size:10pt;">〇 (U+3007)</td>
  </tr>
</table>
"@

$htmlObj = New-Object -ComObject htmlfile
$htmlObj.IHTMLDocument2_write($testHtml)
$range = $htmlObj.body.createTextRange()
$range.execCommand("Copy")

$ws.Cells.Item(6, 1).Select()
$ws.Paste()

# 貼り付けられたセルのフォント名を確認
for ($col = 1; $col -le 5; $col++) {
    $c = $ws.Cells.Item(6, $col)
    $val = $c.Text
    $fn = $c.Font.Name
    Write-Output "Col $col : Val='$val' | Font='$fn'"
}

$testFile = Join-Path (Get-Location).Path "test_circle_compare.xlsx"
$wb.SaveAs($testFile)
$wb.Close($false)
$excel.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
Write-Output "SUCCESS: saved to $testFile"
