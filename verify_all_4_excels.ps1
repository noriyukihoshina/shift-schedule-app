$files = @(
    "test_term28_blank.xlsx",
    "test_term28_export.xlsx",
    "test_term29_blank.xlsx",
    "test_term29_export.xlsx"
)

$allPassed = $true
foreach ($f in $files) {
    Write-Output "Testing $f with ZoneId=3..."
    $res = powershell -ExecutionPolicy Bypass -File .\test_zone_both.ps1 -FilePath $f
    Write-Output $res
    if ($res -notmatch "SUCCESS") {
        $allPassed = $false
    }
}

if ($allPassed) {
    Write-Output "ALL 4 EXCEL FILES OPENED FLAWLESSLY WITH ZONEID=3 (PROTECTED VIEW)!"
} else {
    Write-Output "SOME EXCEL FILES FAILED TO OPEN!"
}
