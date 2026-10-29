$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$logFile = Join-Path $dir "debug_south_console.log"

$htmlPath = Join-Path $dir "south.html"
$htmlContent = [System.IO.File]::ReadAllText($htmlPath, [System.Text.Encoding]::UTF8)

$injected = @"
<script>
window.addEventListener('load', () => {
    setTimeout(() => {
        try {
            console.log('STAFF_COUNT: ' + staffList.length);
            const secCount = {};
            staffList.forEach(s => {
                if (!s.isUnused) {
                    secCount[s.section || 'EMPTY'] = (secCount[s.section || 'EMPTY'] || 0) + 1;
                }
            });
            console.log('SOUTH_SECTIONS: ' + JSON.stringify(secCount));
        } catch(e) {
            console.log('DEBUG_ERR: ' + e.message);
        }
    }, 1500);
});
</script>
"@

$tempHtml = Join-Path $dir "_debug_south_temp.html"
[System.IO.File]::WriteAllText($tempHtml, $htmlContent.Replace("</body>", $injected + "</body>"), [System.Text.Encoding]::UTF8)

$tempUrl = "file:///" + ($tempHtml.Replace('\', '/'))
$p = Start-Process -FilePath $edge -ArgumentList "--headless=new", "--enable-logging=stderr", "--v=1", $tempUrl -RedirectStandardError $logFile -NoNewWindow -PassThru
Start-Sleep -Seconds 4
if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force }
Start-Sleep -Milliseconds 500

$log = [System.IO.File]::ReadAllText($logFile, [System.Text.Encoding]::UTF8)
$log -split "`r?`n" | Where-Object { $_ -match "STAFF_COUNT|SOUTH_SECTIONS|DEBUG_ERR" }
