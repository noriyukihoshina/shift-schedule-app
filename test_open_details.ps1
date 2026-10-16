$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$dir = Get-Location

$cases = @('test_slash_sheetname.xlsx', 'test_safe_sheetname.xlsx')

foreach ($c in $cases) {
    $path = Join-Path $dir $c
    Write-Output "=== Testing $c ==="
    try {
        $wb = $excel.Workbooks.Open($path)
        Write-Output "  Workbooks.Open: SUCCESS! Sheets: $($wb.Sheets.Count)"
        $wb.Close($false)
    } catch {
        Write-Output "  Workbooks.Open: FAILED - $($_.Exception.Message)"
    }

    # ProtectedView test with ZoneId=3
    $rnd = [System.IO.Path]::GetRandomFileName() + "_" + $c
    $dst = Join-Path $dir $rnd
    [System.IO.File]::Copy($path, $dst, $true)
    Set-Content -Path ($dst + ':Zone.Identifier') -Value "[ZoneTransfer]`r`nZoneId=3"
    try {
        $pv = $excel.ProtectedViewWindows.Open($dst)
        Write-Output "  ProtectedView: SUCCESS! Caption: $($pv.Caption)"
        $pv.Close()
    } catch {
        Write-Output "  ProtectedView: FAILED - $($_.Exception.Message)"
    }
}

$excel.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
