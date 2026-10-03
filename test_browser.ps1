$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$indexPath = (Get-Item "index.html").FullName
$url = "file:///" + $indexPath.Replace("\", "/")

# Capture console logs by injecting script
$testHtml = Get-Content "index.html" -Raw -Encoding UTF8
$injected = @"
<script>
window.testErrors = [];
window.addEventListener('error', function(e) {
    window.testErrors.push(e.message + ' at ' + e.filename + ':' + e.lineno);
});
window.addEventListener('load', function() {
    setTimeout(function() {
        var res = document.createElement('div');
        res.id = 'test-result-summary';
        res.innerText = 'ERRORS: ' + JSON.stringify(window.testErrors);
        document.body.appendChild(res);
    }, 500);
});
</script>
"@
$testHtml = $testHtml.Replace("</body>", $injected + "</body>")
[System.IO.File]::WriteAllText("temp_check_errors.html", $testHtml, [System.Text.Encoding]::UTF8)

$testUrl = "file:///" + (Get-Item "temp_check_errors.html").FullName.Replace("\", "/")
$out = & $edge --headless --virtual-time-budget=2000 --dump-dom $testUrl
if ($out -match 'id="test-result-summary">(.*?)</div>') {
    Write-Output $matches[1]
} else {
    Write-Output "Result tag not found"
}
