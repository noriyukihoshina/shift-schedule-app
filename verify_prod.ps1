$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$url = "https://shift-schedule-app-ruby.vercel.app"
$port = 8092
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

$checkHtml = @"
<!DOCTYPE html>
<html><body>
<iframe id="prodFrame" src="$url" style="width:1200px; height:800px;"></iframe>
<script>
window.onload = () => {
    const frame = document.getElementById("prodFrame");
    frame.onload = () => {
        try {
            const doc = frame.contentDocument || frame.contentWindow.document;
            const title = doc.title;
            const solveBtn = !!doc.getElementById("solveBtn");
            const importModBtn = !!doc.getElementById("importModifiedScheduleFileInput");
            const validateOutBtn = !!doc.getElementById("validateOutputBtn");
            const validateInBtn = !!doc.getElementById("validateInputBtn");
            const banner = !!doc.getElementById("outputConflictAlertBanner");
            
            const res = {
                title: title,
                solveBtn: solveBtn,
                importModBtn: importModBtn,
                validateOutBtn: validateOutBtn,
                validateInBtn: validateInBtn,
                banner: banner,
                success: true
            };
            fetch("http://localhost:$port/result", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(res)
            });
        } catch(e) {
            fetch("http://localhost:$port/result", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({ error: e.message, success: false })
            });
        }
    };
};
</script>
</body></html>
"@
$checkFile = Join-Path $PSScriptRoot "test_prod_verify.html"
[System.IO.File]::WriteAllText($checkFile, $checkHtml, [System.Text.Encoding]::UTF8)
$fileUri = [System.Uri]::new($checkFile).AbsoluteUri

$proc = Start-Process -FilePath $edge -ArgumentList "--headless", "--disable-gpu", "`"$fileUri`"" -PassThru -NoNewWindow

$context = $listener.GetContext()
$reader = New-Object System.IO.StreamReader($context.Request.InputStream, [System.Text.Encoding]::UTF8)
$json = $reader.ReadToEnd()

$context.Response.StatusCode = 200
$buf = [System.Text.Encoding]::UTF8.GetBytes("OK")
$context.Response.OutputStream.Write($buf, 0, $buf.Length)
$context.Response.OutputStream.Close()
$listener.Stop()
$listener.Close()
try { $proc.Kill() } catch {}

Write-Output "--- Production Live Verification Result ---"
Write-Output $json
