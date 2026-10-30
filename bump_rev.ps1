$files = Get-ChildItem -Path $PSScriptRoot -Filter "*.html"
foreach ($f in $files) {
    $c = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
    if ($c.Contains("rev79")) {
        $c = $c.Replace("rev79", "rev80")
        [System.IO.File]::WriteAllText($f.FullName, $c, [System.Text.Encoding]::UTF8)
        Write-Output "Bumped to rev80: $($f.Name)"
    }
}
