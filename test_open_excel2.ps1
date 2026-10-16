$src = Join-Path $PSScriptRoot "test_full_schedule.xlsx"
$dst = "C:\Users\coffe\test_excel_debug.xlsx"
[System.IO.File]::Copy($src, $dst, $true)

try {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $wb = $excel.Workbooks.Open($dst)
    Write-Output "SUCCESS: Successfully opened workbook! Name: $($wb.Name)"
    $wb.Close($false)
    $excel.Quit()
} catch {
    Write-Output "ERROR opening workbook: $($_.Exception.Message)"
    if ($excel) { $excel.Quit() }
}
