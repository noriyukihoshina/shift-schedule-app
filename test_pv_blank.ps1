$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# ゾンビExcelプロセスをクリーンアップ
Get-Process excel -ErrorAction SilentlyContinue | Stop-Process -Force

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$f = "verified_staff_blank_template.xlsx"
$dst = Join-Path $scriptDir ("pv_test_" + $f)
[System.IO.File]::Copy((Join-Path $scriptDir $f), $dst, $true)
Set-Content -Path ($dst + ":Zone.Identifier") -Value "[ZoneTransfer]`r`nZoneId=3"

try {
    $pv = $excel.ProtectedViewWindows.Open($dst)
    Write-Output "SUCCESS PV: $f"
    $wb = $pv.Edit()
    Write-Output "SUCCESS EDIT: $($wb.Name)"
    $wb.Close($false)
} catch {
    Write-Output "FAILED: $f - $($_.Exception.Message)"
} finally {
    $excel.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
}
