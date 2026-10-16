$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$dir = Get-Location
$cases = @('test_h_test3_r53.xlsx', 'test_h_test3_r53.xlsx')

foreach ($c in $cases) {
    $src = Join-Path $dir $c
    $dst = Join-Path $dir ('pv_test_' + $c)
    [System.IO.File]::Copy($src, $dst, $true)
    Set-Content -Path ($dst + ':Zone.Identifier') -Value "[ZoneTransfer]`r`nZoneId=3"
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
