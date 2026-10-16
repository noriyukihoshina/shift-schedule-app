$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}
$here = $PSScriptRoot
$htmlPath = Join-Path $here "test_1215_term.html"
$uri = [System.Uri]::new($htmlPath).AbsoluteUri
$outFile = Join-Path $here "test_1215_res.txt"

cmd.exe /c "`"$edgePath`" --headless --disable-gpu --dump-dom `"$uri`" > `"$outFile`""

if (Test-Path $outFile) {
    $raw = Get-Content $outFile -Raw -Encoding UTF8
    if ($raw -match '<div id="test-output">([\s\S]*?)</div>') {
        Write-Host "=== TEST OUTPUT ==="
        Write-Host $matches[1]
    } else {
        Write-Host "Regex match failed. Raw length: " $raw.Length
    }
}
