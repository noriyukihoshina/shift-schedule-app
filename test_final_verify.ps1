$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Get-Process excel -ErrorAction SilentlyContinue | Stop-Process -Force

$src = Join-Path $scriptDir "test_final_production.xlsx"
$dst = Join-Path $scriptDir "pv_test_final_production.xlsx"
[System.IO.File]::Copy($src, $dst, $true)
Set-Content -Path ($dst + ":Zone.Identifier") -Value "[ZoneTransfer]`r`nZoneId=3"

Write-Output "=== 1. 通常オープン検証 ==="
$excel1 = New-Object -ComObject Excel.Application
$excel1.Visible = $false
$excel1.DisplayAlerts = $false
try {
    $wb = $excel1.Workbooks.Open($src)
    Write-Output "SUCCESS: 通常オープン成功! シート名: $($wb.Sheets.Item(1).Name)"
    $ws = $wb.Sheets.Item(1)
    Write-Output "A4 (スタッフ1): $($ws.Range('A4').Text)"
    Write-Output "AD4 数式: $($ws.Range('AD4').Formula)"
    Write-Output "A52 (出勤人数合計): $($ws.Range('A52').Text)"
    Write-Output "B52 数式: $($ws.Range('B52').Formula)"
    Write-Output "A53 (実数合計): $($ws.Range('A53').Text)"
    Write-Output "B53 数式: $($ws.Range('B53').Formula)"
    Write-Output "A54 (PT A 出勤): $($ws.Range('A54').Text)"
    Write-Output "B54 数式: $($ws.Range('B54').Formula)"
    Write-Output "A58 (ST 出勤): $($ws.Range('A58').Text)"
    Write-Output "B58 数式: $($ws.Range('B58').Formula)"
    $wb.Close($false)
} catch {
    Write-Output "FAILED 通常オープン: $($_.Exception.Message)"
} finally {
    $excel1.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel1) | Out-Null
}

Write-Output "`n=== 2. 保護ビュー (ZoneId=3: Mark of the Web) 検証 ==="
$excel2 = New-Object -ComObject Excel.Application
$excel2.Visible = $false
$excel2.DisplayAlerts = $false
try {
    $pv = $excel2.ProtectedViewWindows.Open($dst)
    Write-Output "SUCCESS: 保護ビューでの開通に完全成功! キャプション: $($pv.Caption)"
    $pv.Close()
} catch {
    Write-Output "FAILED 保護ビュー: $($_.Exception.Message)"
} finally {
    $excel2.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel2) | Out-Null
}
