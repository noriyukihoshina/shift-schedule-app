$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$files = @(
    "test_pv_new.xlsx",
    "test_pv_result.xlsx",
    "test_minimal_pure.xlsx",
    "sample_native.xlsx",
    "test_store.xlsx"
)

foreach ($f in $files) {
    $p = Join-Path $scriptDir $f
    if (Test-Path $p) {
        try {
            $wb = $excel.Workbooks.Open($p)
            Write-Output "SUCCESS: $f"
            $wb.Close($false)
        } catch {
            Write-Output "FAILED: $f - $($_.Exception.Message)"
        }
    } else {
        Write-Output "NOT FOUND: $f"
    }
}
$excel.Quit()
