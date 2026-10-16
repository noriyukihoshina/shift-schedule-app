param([string]$FilePath)
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
try {
    $fullPath = (Resolve-Path $FilePath).Path
    $wb = $excel.Workbooks.Open($fullPath)
    Write-Output "SUCCESS: Successfully opened $($wb.Name), Sheet count: $($wb.Sheets.Count)"
    $sheet = $wb.Sheets.Item(1)
    Write-Output "Sheet name: $($sheet.Name)"
    $wb.Close($false)
} catch {
    Write-Output "ERROR: $($_.Exception.Message)"
} finally {
    $excel.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
}
