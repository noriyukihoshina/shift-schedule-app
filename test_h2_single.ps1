$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$f = "test_h2_staff48_formulas.xlsx"
$dst = Join-Path $scriptDir ("pv_test_" + $f)
try {
    $pv = $excel.ProtectedViewWindows.Open($dst)
    Write-Output "SUCCESS: $f"
    $pv.Close()
} catch {
    Write-Output "FAILED: $f - $($_.Exception.Message)"
} finally {
    $excel.Quit()
}
