$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$cases = @(
    "test_case_A_minimal.xlsx",
    "test_case_B_cols.xlsx",
    "test_case_C_pagesetup.xlsx",
    "test_case_D_rawquotes.xlsx",
    "test_case_E_entityquotes.xlsx",
    "test_case_F_footer_raw.xlsx",
    "test_case_G_footer_entity.xlsx"
)

foreach ($c in $cases) {
    $p = Join-Path $scriptDir $c
    try {
        $wb = $excel.Workbooks.Open($p)
        Write-Output "SUCCESS: $c"
        $wb.Close($false)
    } catch {
        Write-Output "FAILED: $c - $($_.Exception.Message)"
    }
}
$excel.Quit()
