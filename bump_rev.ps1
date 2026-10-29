$files = Get-ChildItem -Path $PSScriptRoot -Filter "*.html"
foreach ($f in $files) {
    $c = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
    if ($c.Contains("rev66")) {
        $c = $c.Replace("rev66", "rev67")
        [System.IO.File]::WriteAllText($f.FullName, $c, [System.Text.Encoding]::UTF8)
        Write-Output "Bumped to rev67: $($f.Name)"
    }
}
