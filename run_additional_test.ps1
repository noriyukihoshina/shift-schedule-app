$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}
$here = $PSScriptRoot

function RunTest($htmlName) {
    $htmlPath = Join-Path $here $htmlName
    $uri = [System.Uri]::new($htmlPath).AbsoluteUri
    $outFile = Join-Path $here "temp_out.txt"

    cmd.exe /c "`"$edgePath`" --headless --disable-gpu --dump-dom `"$uri`" > `"$outFile`""
    if (Test-Path $outFile) {
        $raw = Get-Content $outFile -Raw -Encoding UTF8
        if ($raw -match '<div id="test-output">([\s\S]*?)</div>') {
            Write-Host "=== $htmlName RESULTS ==="
            Write-Host $matches[1]
        } else {
            Write-Host "No output for $htmlName"
        }
    }
}

RunTest "test_footer_and_undo.html"
RunTest "test_additional_requirements.html"
RunTest "test_ui_interactions.html"
