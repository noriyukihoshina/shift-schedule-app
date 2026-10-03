Add-Type -AssemblyName System.Windows.Forms
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Add()
$ws = $wb.Sheets.Item(1)

# C4, D4 に ○ を設定
$cWork = [string][char]0x25CB
$ws.Range("C4").Value2 = $cWork
$ws.Range("D4").Value2 = $cWork

# 1. x:num と x:f
# 2. 直接数式
$html = "<table><tr><td x:num=""2"" x:f=""=COUNTIF(C4:D4,&quot;$cWork&quot;)"">2</td><td>=COUNTIF(C4:D4,&quot;$cWork&quot;)</td></tr></table>"
[System.Windows.Forms.Clipboard]::SetText($html, [System.Windows.Forms.TextDataFormat]::Html)

$ws.Range("AE4").Select()
$ws.Paste()

Write-Output ("AE4 (with x:num and x:f): Value2=" + $ws.Range("AE4").Value2 + ", Formula=" + $ws.Range("AE4").Formula + ", Text=" + $ws.Range("AE4").Text)
Write-Output ("AF4 (plain =COUNTIF):     Value2=" + $ws.Range("AF4").Value2 + ", Formula=" + $ws.Range("AF4").Formula + ", Text=" + $ws.Range("AF4").Text)

$wb.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
