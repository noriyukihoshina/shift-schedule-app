$files = Get-ChildItem -Path $PSScriptRoot -Filter "*.html"
foreach ($f in $files) {
    $c = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
    if ($c.Contains("rev67")) {
        $c = $c.Replace("rev67", "rev68")
        [System.IO.File]::WriteAllText($f.FullName, $c, [System.Text.Encoding]::UTF8)
        Write-Output "Bumped to rev68: $($f.Name)"
    }
}
