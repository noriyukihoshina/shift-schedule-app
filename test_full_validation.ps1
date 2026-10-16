$tempDir = [System.IO.Path]::GetTempPath()
$c = 'test_from_appjs.xlsx'

Write-Output "=== Testing $c ==="
$src = Join-Path (Get-Location) $c
$tempFile = Join-Path $tempDir ([System.IO.Path]::GetRandomFileName() + ".xlsx")

[System.IO.File]::Copy($src, $tempFile, $true)
Set-Content -Path ($tempFile + ':Zone.Identifier') -Value "[ZoneTransfer]`r`nZoneId=3"

Start-Sleep -Milliseconds 500

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

try {
    # 1. ProtectedView (ダウンロード直後の開通)
    $pv = $excel.ProtectedViewWindows.Open($tempFile)
    Write-Output "  ProtectedView: SUCCESS! Caption: $($pv.Caption)"
    
    # 2. 編集を有効にする (Edit)
    $wb = $pv.Edit()
    Write-Output "  Edit (Normal View): SUCCESS! Sheet name: $($wb.Sheets.Item(1).Name)"
    
    # 3. セル値と数式の計算結果チェック
    $sheet = $wb.Sheets.Item(1)
    Write-Output "  Title cell A1: $($sheet.Range('A1').Text)"
    Write-Output "  Work count formula at B52: $($sheet.Range('B52').Formula)"
    Write-Output "  Work count calculated value at B52: $($sheet.Range('B52').Value2)"
    Write-Output "  Real count formula at B53: $($sheet.Range('B53').Formula)"
    Write-Output "  Real count calculated value at B53: $($sheet.Range('B53').Value2)"
    Write-Output "  PT A formula at B54: $($sheet.Range('B54').Formula)"
    Write-Output "  PT A calculated value at B54: $($sheet.Range('B54').Value2)"
    Write-Output "  Early formula at B59: $($sheet.Range('B59').Formula)"
    Write-Output "  Early calculated value at B59: $($sheet.Range('B59').Value2)"
    
    $wb.Close($false)
    Write-Output "=== ALL EXCEL TESTS PASSED SUCCESSFULLY! ==="
} catch {
    Write-Output "  FAILED at line $($_.InvocationInfo.ScriptLineNumber): $($_.Exception.Message)"
} finally {
    $excel.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}
