$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$expFiles = @(
    "test_exp1_okstyles.xlsx",
    "test_exp2_oksheet.xlsx",
    "test_exp3_allok.xlsx"
)

foreach ($f in $expFiles) {
    $p = Join-Path $scriptDir $f
    try {
        $wb = $excel.Workbooks.Open($p)
        Write-Output "SUCCESS: $f (Sheets: $($wb.Sheets.Count))"
        $wb.Close($false)
    } catch {
        Write-Output "FAILED: $f - $($_.Exception.Message)"
    }
}
$excel.Quit()
