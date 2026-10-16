$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$f = "test_h3_simple_footer.xlsx"
$dst = Join-Path $scriptDir ("pv_test_" + $f)
try {
    $pv = $excel.ProtectedViewWindows.Open($dst)
    Write-Output "SUCCESS: $f"
    $wb = $pv.Edit()
    Write-Output "SUCCESS EDIT: $($wb.Name)"
    $wb.Close($false)
} catch {
    Write-Output "FAILED: $f - $($_.Exception.Message)"
} finally {
    $excel.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
}
