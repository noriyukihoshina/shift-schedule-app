$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Get-Process excel -ErrorAction SilentlyContinue | Stop-Process -Force

$cases = @(
    "test_r53_text.xlsx",
    "test_r53_ref.xlsx",
    "test_r53_sum.xlsx"
)

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

foreach ($c in $cases) {
    $src = Join-Path $scriptDir $c
    $dst = Join-Path $scriptDir ("pv_" + $c)
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
