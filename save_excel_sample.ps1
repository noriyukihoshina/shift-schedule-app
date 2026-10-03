$here = Get-Location
$xlsxPath = Join-Path $here "verified_blank_template.xlsx"
$userSavedPath = Join-Path $here "staff_filled_sample.xlsx"

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Open($xlsxPath)
$sheet = $wb.Sheets.Item(1)

# Staff 1: L3 (4/1) = OFF (0x4F11), M3 (4/2) = PAID (0x6709)
$sheet.Range("L3").Value2 = [string][char]0x4F11
$sheet.Range("M3").Value2 = [string][char]0x6709

# Staff 2: Q4 (4/6) = EARLY (0x65E9)
$sheet.Range("Q4").Value2 = [string][char]0x65E9

# Staff 3: V5 (4/11) = HALF (0x25CB / 0x4F11)
$sheet.Range("V5").Value2 = ([string][char]0x25CB + "/" + [string][char]0x4F11)

# Staff 4: AA6 (4/16) = REF1 (0x4E0A + '1')
$sheet.Range("AA6").Value2 = ([string][char]0x4E0A + "1")

$wb.SaveAs($userSavedPath)
$wb.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
Write-Output "Excel COM: Simulated staff filled input and saved to $userSavedPath"

$bytes = [System.IO.File]::ReadAllBytes($userSavedPath)
$b64 = [Convert]::ToBase64String($bytes)
[System.IO.File]::WriteAllText((Join-Path $here "temp_b64.txt"), $b64, [System.Text.Encoding]::UTF8)
Write-Output "Saved Base64 to temp_b64.txt (Length: $($b64.Length))"
