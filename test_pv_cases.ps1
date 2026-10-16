$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$cases = @(
    "verified_staff_blank_template.xlsx",
    "test_case_A_minimal.xlsx",
    "test_case_B_cols.xlsx",
    "test_case_C_pagesetup.xlsx",
    "test_case_D_rawquotes.xlsx",
    "test_case_E_entityquotes.xlsx",
    "test_case_F_footer_raw.xlsx",
    "test_case_G_footer_entity.xlsx"
)

foreach ($c in $cases) {
    $src = Join-Path $scriptDir $c
    $dst = Join-Path $scriptDir ("pv_test_" + $c)
    [System.IO.File]::Copy($src, $dst, $true)
    Set-Content -Path ($dst + ":Zone.Identifier") -Value "[ZoneTransfer]`r`nZoneId=3"
    
    try {
        $pv = $excel.ProtectedViewWindows.Open($dst)
        Write-Output "SUCCESS ProtectedView: $c (Caption: $($pv.Caption))"
        $pv.Close()
    } catch {
        Write-Output "FAILED ProtectedView: $c - $($_.Exception.Message)"
    }
}
$excel.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
