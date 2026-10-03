$solver = Get-Content '.\solver.js' -Raw -Encoding UTF8
$runner = Get-Content '.\test_runner.html' -Raw -Encoding UTF8
$inlined = $runner.Replace('<script src="solver.js"></script>', "<script>`n$solver`n</script>")
Set-Content -Path '.\test_runner_standalone.html' -Value $inlined -Encoding UTF8
Write-Host "Created test_runner_standalone.html"
