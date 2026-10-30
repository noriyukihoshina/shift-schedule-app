$files = Get-ChildItem -Path $PSScriptRoot -Filter "*.html"
$currentRev = "rev86"
$nextRev = "rev87"

foreach ($f in $files) {
    $c = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
    if ($c.Contains($currentRev)) {
        $c = $c.Replace($currentRev, $nextRev)
        [System.IO.File]::WriteAllText($f.FullName, $c, [System.Text.Encoding]::UTF8)
        Write-Output "Bumped to $nextRev : $($f.Name)"
    }
}
