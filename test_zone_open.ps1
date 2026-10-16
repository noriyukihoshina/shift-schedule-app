$dst = "C:\Users\coffe\test_excel_zone.xlsx"
$src = "C:\Users\coffe\test_excel_debug.xlsx"
[System.IO.File]::Copy($src, $dst, $true)

Set-Content -Path ($dst + ":Zone.Identifier") -Value "[ZoneTransfer]`r`nZoneId=3"

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
try {
    $wb = $excel.Workbooks.Open($dst)
    Write-Output "SUCCESS: Opened with ZoneId=3! Name: $($wb.Name)"
    $wb.Close($false)
} catch {
    Write-Output "ERROR with ZoneId=3: $($_.Exception.Message)"
} finally {
    $excel.Quit()
}
