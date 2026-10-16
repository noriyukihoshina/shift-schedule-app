$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Get-Process excel -ErrorAction SilentlyContinue | Stop-Process -Force

$src = Join-Path $scriptDir "test_case_H_full_static.xlsx"
$dst = Join-Path $scriptDir "pv_test_case_H_correct.xlsx"
[System.IO.File]::Copy($src, $dst, $true)
Set-Content -Path ($dst + ":Zone.Identifier") -Value "[ZoneTransfer]`r`nZoneId=3"

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

try {
    $pv = $excel.ProtectedViewWindows.Open($dst)
    Write-Output "SUCCESS: Case H (full 48 staff + all footers) opened in ProtectedView! Caption: $($pv.Caption)"
    $pv.Close()
} catch {
    Write-Output "FAILED Case H: $($_.Exception.Message)"
} finally {
    $excel.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
}
