$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Add()
$sheet = $wb.Sheets.Item(1)

$startCol = 'C'
$endCol = 'AD'
$rowNum = 4
$rng = "$startCol$rowNum`:$endCol$rowNum"

# Characters
$cWork = [string][char]0x25CB # ○
$cOff  = [string][char]0x4F11 # 休
$cPaid = [string][char]0x6709 # 有
$cEarly = [string][char]0x65E9 # 早
$cLate  = [string][char]0x9045 # 遅
$cEve   = "E"
$cH8    = "8" + [string][char]0x6642 # 8時

$sheet.Range("C4").Value2 = $cWork
$sheet.Range("D4").Value2 = $cOff
$sheet.Range("E4").Value2 = $cPaid

$fWork = "=COUNTIF($rng,`"$cWork`")+COUNTIF($rng,`"出`")+COUNTIF($rng,`"$cEarly`")+COUNTIF($rng,`"$cLate`")+COUNTIF($rng,`"$cEve`")+COUNTIF($rng,`"$cH8`")+0.5*(COUNTIF($rng,`"$cWork/$cOff`")+COUNTIF($rng,`"$cOff/$cWork`")+COUNTIF($rng,`"$cWork/$cPaid`")+COUNTIF($rng,`"$cPaid/$cWork`"))"
$fOff  = "=COUNTIF($rng,`"$cOff`")+0.5*(COUNTIF($rng,`"$cWork/$cOff`")+COUNTIF($rng,`"$cOff/$cWork`"))"
$fPaid = "=COUNTIF($rng,`"$cPaid`")+0.5*(COUNTIF($rng,`"$cWork/$cPaid`")+COUNTIF($rng,`"$cPaid/$cWork`"))"
$fEarly = "=COUNTIF($rng,`"$cEarly`")"
$fLate  = "=COUNTIF($rng,`"$cLate`")"
$fEve   = "=COUNTIF($rng,`"$cEve`")"
$fH8    = "=COUNTIF($rng,`"$cH8`")"

$sheet.Range("AE4").Formula = $fWork
$sheet.Range("AF4").Formula = $fOff
$sheet.Range("AG4").Formula = $fPaid
$sheet.Range("AI4").Formula = $fEarly
$sheet.Range("AJ4").Formula = $fLate
$sheet.Range("AK4").Formula = $fEve
$sheet.Range("AL4").Formula = $fH8

$excel.Calculate()

Write-Output "--- Direct Formula in Excel Test ---"
Write-Output "AE4 (Work):  Value=$($sheet.Range('AE4').Value2), Formula=$($sheet.Range('AE4').Formula), Text=$($sheet.Range('AE4').Text)"
Write-Output "AF4 (Off):   Value=$($sheet.Range('AF4').Value2), Formula=$($sheet.Range('AF4').Formula), Text=$($sheet.Range('AF4').Text)"
Write-Output "AG4 (Paid):  Value=$($sheet.Range('AG4').Value2), Formula=$($sheet.Range('AG4').Formula), Text=$($sheet.Range('AG4').Text)"
Write-Output "AI4 (Early): Value=$($sheet.Range('AI4').Value2), Formula=$($sheet.Range('AI4').Formula), Text=$($sheet.Range('AI4').Text)"
Write-Output "AJ4 (Late):  Value=$($sheet.Range('AJ4').Value2), Formula=$($sheet.Range('AJ4').Formula), Text=$($sheet.Range('AJ4').Text)"
Write-Output "AK4 (Eve):   Value=$($sheet.Range('AK4').Value2), Formula=$($sheet.Range('AK4').Formula), Text=$($sheet.Range('AK4').Text)"
Write-Output "AL4 (8h):    Value=$($sheet.Range('AL4').Value2), Formula=$($sheet.Range('AL4').Formula), Text=$($sheet.Range('AL4').Text)"

$wb.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
