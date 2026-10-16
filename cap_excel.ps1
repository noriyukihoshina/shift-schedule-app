Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $true
$excel.WindowState = 2 # Maximize

$testPath = Join-Path (Get-Location).Path "test_circles_pure.xlsx"
$wb = $excel.Workbooks.Open($testPath)
Start-Sleep -Milliseconds 1000

# スクリーンキャプチャ
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)

$capPath = Join-Path (Get-Location).Path "excel_capture.png"
$bmp.Save($capPath, [System.Drawing.Imaging.ImageFormat]::Png)

$graphics.Dispose()
$bmp.Dispose()

$wb.Close($false)
$excel.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null

Write-Output "Screenshot saved to $capPath"
