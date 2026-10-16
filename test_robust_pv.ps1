$cases = @(
    'test_prod_with_all_styles.xlsx'
)

$dir = Get-Location

foreach ($c in $cases) {
    $src = Join-Path $dir $c
    $rnd = [System.IO.Path]::GetRandomFileName() + "_" + $c
    $dst = Join-Path $dir $rnd
    [System.IO.File]::Copy($src, $dst, $true)
    Set-Content -Path ($dst + ':Zone.Identifier') -Value "[ZoneTransfer]`r`nZoneId=3"
    
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    
    try {
        $pv = $excel.ProtectedViewWindows.Open($dst)
        Write-Output "RESULT: SUCCESS - $c (Caption: $($pv.Caption))"
        $pv.Close()
    } catch {
        Write-Output "RESULT: FAILED - $c - $($_.Exception.Message)"
    }
    
    $excel.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
    Start-Sleep -Milliseconds 500
}
