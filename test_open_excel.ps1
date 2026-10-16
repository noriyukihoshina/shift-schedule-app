$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$filePath = Join-Path $scriptDir "test_export_generated.xlsx"
$zoneFile = Join-Path $scriptDir "test_export_zone.xlsx"

Write-Output "Checking file existence: $(Test-Path $filePath)"

Write-Output "--- Test 1: Normal Open ---"
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
try {
    $wb = $excel.Workbooks.Open($filePath)
    Write-Output "SUCCESS: Successfully opened workbook normally! Name: $($wb.Name), Sheets: $($wb.Sheets.Count)"
    $wb.Close($false)
} catch {
    Write-Output "ERROR normally: $($_.Exception.Message)"
} finally {
    $excel.Quit()
}

Write-Output "--- Test 2: With ZoneId=3 (Mark of the Web) ---"
[System.IO.File]::Copy($filePath, $zoneFile, $true)
Set-Content -Path ($zoneFile + ":Zone.Identifier") -Value "[ZoneTransfer]`r`nZoneId=3"

$excel2 = New-Object -ComObject Excel.Application
$excel2.Visible = $false
$excel2.DisplayAlerts = $false
try {
    $pv = $excel2.ProtectedViewWindows.Open($zoneFile)
    Write-Output "SUCCESS: ProtectedViewWindows.Open succeeded! Caption: $($pv.Caption)"
    $pv.Close()
} catch {
    Write-Output "ERROR ProtectedViewWindows.Open: $($_.Exception.Message)"
} finally {
    $excel2.Quit()
}
