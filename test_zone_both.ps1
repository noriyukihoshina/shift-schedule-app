param([string]$FilePath)

$fullPath = (Resolve-Path $FilePath).Path
$uniqueId = [System.Guid]::NewGuid().ToString("N").Substring(0, 8)
$testCopy = [System.IO.Path]::Combine([System.IO.Path]::GetDirectoryName($fullPath), "zone_test_$uniqueId.xlsx")

[System.IO.File]::Copy($fullPath, $testCopy, $true)
Set-Content -Path ($testCopy + ":Zone.Identifier") -Value "[ZoneTransfer]`r`nZoneId=3"

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

try {
    $wb = $excel.Workbooks.Open($testCopy)
    Write-Output "SUCCESS: Successfully opened with ZoneId=3! $($wb.Name), Sheets: $($wb.Sheets.Count)"
    $sheet = $wb.Sheets.Item(1)
    Write-Output "Sheet Name: $($sheet.Name)"
    $wb.Close($false)
} catch {
    Write-Output "ERROR with ZoneId=3: $($_.Exception.Message)"
} finally {
    $excel.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
}
