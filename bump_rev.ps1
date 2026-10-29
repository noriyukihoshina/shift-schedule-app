$files = Get-ChildItem -Path $PSScriptRoot -Filter "*.html"
foreach ($f in $files) {
    $c = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
    if ($c.Contains("rev74")) {
        $c = $c.Replace("rev74", "rev75")
        [System.IO.File]::WriteAllText($f.FullName, $c, [System.Text.Encoding]::UTF8)
        Write-Output "Bumped to rev75: $($f.Name)"
    }
}
