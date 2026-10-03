$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$htmlPath = (Get-Item "test_app_integration.html").FullName
$url = "file:///" + $htmlPath.Replace("\", "/")
$output = & $edge --headless --dump-dom $url

if ($output -match 'SUCCESS: items=(\d+)') {
    Write-Output "Integration Test: SUCCESS! Items parsed=$($matches[1])"
    if ($output -match 'b64=([A-Za-z0-9+/=]+)') {
        $b64 = $matches[1]
        $bytes = [Convert]::FromBase64String($b64)
        $outPath = Join-Path (Get-Location) "test_generated_blank.xlsx"
        [System.IO.File]::WriteAllBytes($outPath, $bytes)
        Write-Output "Saved XLSX to $outPath (Size: $($bytes.Length) bytes)"

        try {
            $excel = New-Object -ComObject Excel.Application
            $excel.Visible = $false
            $excel.DisplayAlerts = $false
            $wb = $excel.Workbooks.Open($outPath)
            $sheet = $wb.Sheets.Item(1)
            $val = $sheet.Range("L3").Validation
            Write-Output "Excel COM Test: SUCCESS! SheetName=$($sheet.Name), L3.Validation.Type=$($val.Type), Formula=$($val.Formula1)"
            $wb.Close($false)
            $excel.Quit()
            [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
        } catch {
            Write-Output "Excel COM Note: $_"
        }
    }
} else {
    Write-Output "Integration Test: NOT FOUND OR ERROR. First 300 chars of output:"
    Write-Output ($output.Substring(0, [Math]::Min(300, $output.Length)))
}
