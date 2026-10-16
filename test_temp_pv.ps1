$tempDir = [System.IO.Path]::GetTempPath()
$cases = @('test_from_appjs.xlsx')

foreach ($c in $cases) {
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
        $pv = $excel.ProtectedViewWindows.Open($tempFile)
        Write-Output "  RESULT: SUCCESS ProtectedView! Caption: $($pv.Caption)"
        $pv.Close()
    } catch {
        Write-Output "  RESULT: FAILED ProtectedView: $($_.Exception.Message)"
    } finally {
        $excel.Quit()
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
        [System.GC]::Collect()
        [System.GC]::WaitForPendingFinalizers()
    }
    
    Start-Sleep -Milliseconds 500
}
