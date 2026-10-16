Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$testPath = Join-Path (Get-Location).Path "test_circles_pure.xlsx"
$wb = $excel.Workbooks.Open($testPath)
$ws = $wb.Worksheets.Item(1)

# Range B1:B4 を画像としてクリップボードへコピー (1 = xlScreen, 2 = xlBitmap)
$rng = $ws.Range("A1:B4")
$rng.CopyPicture(1, 2)

Start-Sleep -Milliseconds 500

$img = [System.Windows.Forms.Clipboard]::GetImage()
if ($img -ne $null) {
    $capPath = Join-Path (Get-Location).Path "range_capture.png"
    $img.Save($capPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $img.Dispose()
    Write-Output "Range image saved: $capPath"
} else {
    Write-Output "Clipboard image was null"
}

$wb.Close($false)
$excel.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
