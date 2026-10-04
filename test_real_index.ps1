$here = (Get-Location).Path
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'

$indexPath = Join-Path $here 'index.html'

$dumpFile = Join-Path $here 'temp_real_index_dump.txt'
$proc = Start-Process -FilePath $edge -ArgumentList "--headless", "--disable-gpu", "--dump-dom", "$indexPath" -RedirectStandardOutput $dumpFile -PassThru -NoNewWindow
$proc.WaitForExit(10000)

$dump = [System.IO.File]::ReadAllText($dumpFile, [System.Text.Encoding]::UTF8)

# dump内容の確認
Write-Output "--- Check Elements in index.html ---"
Write-Output ("Has termStartDate: " + ($dump.Contains('id="termStartDate"')))
Write-Output ("Has copyExcelDirectBtn: " + ($dump.Contains('copyExcelDirectBtn') -or $dump.Contains('copyForExcel')))
Write-Output ("Has exportExcelBtn: " + ($dump.Contains('exportExcelBtn')))
Write-Output ("Has undoBtn: " + ($dump.Contains('id="undoBtn"')))
Write-Output ("Has redoBtn: " + ($dump.Contains('id="redoBtn"')))
Write-Output ("Has btnExportBlank: " + ($dump.Contains('id="btnExportBlank"')))
