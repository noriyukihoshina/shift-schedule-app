$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$testFiles = @(
    "verified_staff_blank_template.xlsx",
    "verified_blank_template.xlsx",
    "test_valid_template.xlsx",
    "test_export_generated.xlsx"
)

foreach ($f in $testFiles) {
    $p = Join-Path $scriptDir $f
    if (Test-Path $p) {
        try {
            $wb = $excel.Workbooks.Open($p)
            Write-Output "SUCCESS: Opened $f (Sheets: $($wb.Sheets.Count))"
            $wb.Close($false)
        } catch {
            Write-Output "FAILED: $f - $($_.Exception.Message)"
        }
    } else {
        Write-Output "MISSING: $f"
    }
}
$excel.Quit()
