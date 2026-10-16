$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$bisectFiles = @(
    "test_bisect_0_repack.xlsx",
    "test_bisect_1_sheet1.xlsx",
    "test_bisect_2_styles.xlsx",
    "test_bisect_3_wb.xlsx"
)

foreach ($f in $bisectFiles) {
    $p = Join-Path $scriptDir $f
    try {
        $wb = $excel.Workbooks.Open($p)
        Write-Output "SUCCESS: $f"
        $wb.Close($false)
    } catch {
        Write-Output "FAILED: $f - $($_.Exception.Message)"
    }
}
$excel.Quit()
