$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$testHtml = 'file:///' + ((Join-Path (Get-Location).Path 'test_runner.html') -replace '\\', '/')
Start-Process -FilePath $edge -ArgumentList '--headless', '--allow-file-access-from-files', '--virtual-time-budget=8000', '--dump-dom', $testHtml -RedirectStandardOutput 'test_output.txt' -Wait
Get-Content 'test_output.txt' | Select-String -Pattern 'ALL_TESTS_PASSED|FAILED|RUNNING'
