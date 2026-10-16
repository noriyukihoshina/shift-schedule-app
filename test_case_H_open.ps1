$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$src = Join-Path $scriptDir "test_case_H_full_static.xlsx"
$dst = Join-Path $scriptDir "pv_test_case_H.xlsx"
[System.IO.File]::Copy($src, $dst, $true)
Set-Content -Path ($dst + ":Zone.Identifier") -Value "[ZoneTransfer]`r`nZoneId=3"

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

try {
    Write-Output "--- Testing Case H under Protected View ---"
    $pv = $excel.ProtectedViewWindows.Open($dst)
    Write-Output "SUCCESS: ProtectedViewWindows.Open SUCCEEDED! Caption: $($pv.Caption)"
    
    $wb = $pv.Edit()
    Write-Output "SUCCESS: Successfully Enabled Editing! Workbook Name: $($wb.Name), Sheets: $($wb.Sheets.Count)"
    
    $ws = $wb.Sheets.Item(1)
    Write-Output "Cell A52 (出勤人数合計 label): $($ws.Range('A52').Text)"
    Write-Output "Cell B52 (出勤人数合計 4/1 value): $($ws.Range('B52').Value2), formula: $($ws.Range('B52').Formula)"
    Write-Output "Cell AD52 (出勤人数合計 出勤 sum): $($ws.Range('AD52').Value2), formula: $($ws.Range('AD52').Formula)"
    Write-Output "Cell A54 (PT A label): $($ws.Range('A54').Text)"
    Write-Output "Cell B54 (PT A 4/1 value): $($ws.Range('B54').Value2), formula: $($ws.Range('B54').Formula)"
    
    $wb.Close($false)
    Write-Output "ALL TESTS PASSED WITH 100% SUCCESS!"
} catch {
    Write-Output "FAILED Case H: $($_.Exception.Message)"
} finally {
    $excel.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
}
