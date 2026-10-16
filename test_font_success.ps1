Add-Type -AssemblyName System.Windows.Forms
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Add()
$ws = $wb.Sheets.Item(1)

$cWork = [string][char]0x25CB # ○

$html = @"
<table style="border-collapse:collapse;">
  <tr>
    <td style="font-family:'Meiryo'; font-size:11pt;">MeiryoCSS</td>
    <td style="font-family:'Yu Gothic'; font-size:11pt;">YuGothicCSS</td>
    <td><font face="Meiryo" size="3">FontFaceMeiryo</font></td>
    <td style="font-family:'MS PGothic'; font-size:11pt;">MSPGothicCSS</td>
    <td style="mso-ascii-font-family:Meiryo; mso-fareast-font-family:Meiryo; font-family:Meiryo;">MsoMeiryo</td>
    <td><span>$cWork</span></td>
  </tr>
</table>
"@

[System.Windows.Forms.Clipboard]::SetText($html, [System.Windows.Forms.TextDataFormat]::Html)
Start-Sleep -Milliseconds 500

$ws.Range("A1").Select()
$ws.Paste()

for ($c = 1; $c -le 6; $c++) {
    $cell = $ws.Cells.Item(1, $c)
    Write-Output "Col $c ($($cell.Text)): Font='$($cell.Font.Name)', Size=$($cell.Font.Size)"
}

$wb.Close($false)
$excel.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
