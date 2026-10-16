$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Get-Process excel -ErrorAction SilentlyContinue | Stop-Process -Force

$f = "step1_48staff_single_formula.xlsx"
$src = Join-Path $scriptDir $f
$dst = Join-Path $scriptDir ("pv_" + $f)
[System.IO.File]::Copy($src, $dst, $true)
Set-Content -Path ($dst + ":Zone.Identifier") -Value "[ZoneTransfer]`r`nZoneId=3"

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

try {
    $pv = $excel.ProtectedViewWindows.Open($dst)
    Write-Output "SUCCESS: Step 1 (48 staff) opened in ProtectedView!"
    $pv.Close()
} catch {
    Write-Output "FAILED: Step 1 - $($_.Exception.Message)"
} finally {
    $excel.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
}
