param([int]$MaxLines = 500)

$allLines = Get-Content '.\solver.js' -Encoding UTF8
$part = $allLines[0..($MaxLines - 1)] -join "`n"

$html = @"
<!DOCTYPE html>
<html>
<body>
<div id="res">INIT</div>
<script>
window.onerror = function(msg, url, line) {
    document.getElementById('res').innerHTML = 'ERR at ' + line + ': ' + msg;
};
</script>
<script>
$part
document.getElementById('res').innerHTML = 'OK up to $MaxLines';
</script>
</body>
</html>
"@

Set-Content -Path '.\debug_part.html' -Value $html -Encoding UTF8
Write-Host "Created debug_part.html with $MaxLines lines"
