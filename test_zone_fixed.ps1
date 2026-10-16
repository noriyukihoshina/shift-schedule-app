$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$filePath = Join-Path $scriptDir "test_export_generated.xlsx"
$zoneFile = Join-Path $scriptDir "test_export_zone_fixed.xlsx"

Write-Output "--- Test: With ZoneId=3 (Mark of the Web / Protected View) ---"
[System.IO.File]::Copy($filePath, $zoneFile, $true)
Set-Content -Path ($zoneFile + ":Zone.Identifier") -Value "[ZoneTransfer]`r`nZoneId=3"

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
try {
    # 保護ビューで正常に開けるか検証
    $pv = $excel.ProtectedViewWindows.Open($zoneFile)
    Write-Output "SUCCESS: ProtectedViewWindows.Open SUCCEEDED! Caption: $($pv.Caption)"
    # 保護ビューの編集有効化 (Edit) ができるか検証
    $wb = $pv.Edit()
    Write-Output "SUCCESS: Enabled Editing! Workbook Name: $($wb.Name), Sheets: $($wb.Sheets.Count)"
    $wb.Close($false)
} catch {
    Write-Output "ERROR with ZoneId=3: $($_.Exception.Message)"
} finally {
    $excel.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
}
