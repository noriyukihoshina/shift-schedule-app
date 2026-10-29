$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chromePath)) {
    $chromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
}

$files = @("1f.html", "2f.html", "3f.html", "south.html", "ST.html", "life.html", "index.html")

foreach ($file in $files) {
    $fullPath = Join-Path $PSScriptRoot $file
    $dumpFile = Join-Path $PSScriptRoot "dump_$file"
    
    $proc = Start-Process -FilePath $chromePath -ArgumentList @(
        "--headless",
        "--disable-gpu",
        "--run-all-compositor-stages-before-draw",
        "--virtual-time-budget=4000",
        "--dump-dom",
        "file:///$($fullPath.Replace('\', '/'))"
    ) -NoNewWindow -PassThru -RedirectStandardOutput $dumpFile

    $proc.WaitForExit(10000)
    
    if (Test-Path $dumpFile) {
        $content = [System.IO.File]::ReadAllText($dumpFile, [System.Text.Encoding]::UTF8)
        
        # Check 出勤人数合計 row
        $m = [regex]::Match($content, 'sticky-col-2[^>]*>[^<]*</td>(.*?)(</tr>)', [System.Text.RegularExpressions.RegexOptions]::Singleline)
        Write-Output "Checked: $file"
    }
}
