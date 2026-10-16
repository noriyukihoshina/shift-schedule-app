$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$cases = @(
    "test_h1_staff48_noformula.xlsx",
    "test_h2_staff48_formulas.xlsx",
    "test_h3_simple_footer.xlsx",
    "test_h4_countif_footer.xlsx"
)

foreach ($c in $cases) {
    $src = Join-Path $scriptDir $c
    $dst = Join-Path $scriptDir ("pv_test_" + $c)
    [System.IO.File]::Copy($src, $dst, $true)
    Set-Content -Path ($dst + ":Zone.Identifier") -Value "[ZoneTransfer]`r`nZoneId=3"
    
    try {
        $pv = $excel.ProtectedViewWindows.Open($dst)
        Write-Output "SUCCESS ProtectedView: $c"
        $pv.Close()
    } catch {
        Write-Output "FAILED ProtectedView: $c - $($_.Exception.Message)"
    }
}
$excel.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
