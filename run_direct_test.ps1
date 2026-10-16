$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$testHtml = Join-Path (Get-Location).Path 'test_solver_direct.html'
$dumpOut = Join-Path (Get-Location).Path 'temp_direct_out.txt'

& $edge --headless --virtual-time-budget=5000 --dump-dom $testHtml | Out-File -Encoding utf8 $dumpOut
Get-Content $dumpOut | Select-String -Pattern 'test-log|test-result'
