$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) {
    $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}
$dir = $PSScriptRoot
$url = "file:///" + ($dir.Replace('\', '/') + "/south.html")
$log = Join-Path $dir ("debug_south_actual_" + [System.Guid]::NewGuid().ToString("N") + ".log")

# south.html を開いて特殊勤務を入れるボタンをクリックしたログを取得するスクリプトを注入
$testHtml = Join-Path $dir "_test_south_runner.html"
$htmlContent = @"
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<iframe id="appFrame" src="$url" style="width:1200px; height:800px;"></iframe>
<script>
window.addEventListener('message', (e) => {});
const iframe = document.getElementById('appFrame');
iframe.onload = () => {
    setTimeout(() => {
        try {
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            const win = iframe.contentWindow;
            console.log("IFRAME_LOADED, currentFloor:", win.currentFloor, "isSouth:", win.isSouth);
            
            // 特殊勤務を入れるボタンを探してクリック
            const btn = doc.getElementById('outputAssignSpecialBtn') || doc.getElementById('assignSpecialBtn');
            if (btn) {
                console.log("CLICKING_ASSIGN_SPECIAL_BTN");
                btn.click();
                setTimeout(() => {
                    const modal = doc.getElementById('errorModal');
                    const isModalShow = modal && modal.classList.contains('show');
                    console.log("MODAL_SHOW:", isModalShow);
                    if (isModalShow) {
                        const body = doc.getElementById('errorModalBody');
                        console.log("MODAL_ERRORS:", body ? body.innerText : "");
                    }
                    // checkFinalConstraints の実行結果も直接確認
                    if (typeof win.checkFinalConstraints === 'function') {
                        const res = win.checkFinalConstraints(false);
                        console.log("FINAL_CONSTRAINTS_ERRORS:", JSON.stringify(res ? res.errors : []));
                    }
                }, 1500);
            } else {
                console.log("BTN_NOT_FOUND");
            }
        } catch(e) {
            console.error("DEBUG_ERROR:", e.message);
        }
    }, 2000);
};
</script>
</body>
</html>
"@
[System.IO.File]::WriteAllText($testHtml, $htmlContent, [System.Text.Encoding]::UTF8)

$testUrl = "file:///" + ($testHtml.Replace('\', '/'))
$p = Start-Process -FilePath $edge -ArgumentList "--headless=new", "--enable-logging=stderr", "--v=1", $testUrl -RedirectStandardError $log -NoNewWindow -PassThru
Start-Sleep -Seconds 7
if (-not $p.HasExited) {
    Stop-Process -Id $p.Id -Force
}
Start-Sleep -Milliseconds 500

if (Test-Path $log) {
    $content = Get-Content $log -Encoding UTF8
    $content | Where-Object { $_ -match "IFRAME|CLICKING|MODAL|FINAL_CONSTRAINTS|DEBUG_ERROR|CONSOLE" }
}
