$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$files = Get-ChildItem -Path "$scriptDir\*.html"
foreach ($f in $files) {
    $content = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
    if ($content -match '20261029_rev61') {
        $newContent = $content.Replace('20261029_rev61', '20261029_rev62')
        [System.IO.File]::WriteAllText($f.FullName, $newContent, [System.Text.Encoding]::UTF8)
        Write-Host "Updated to rev62: $($f.Name)"
    }
}
Write-Host "All files updated to rev62 successfully."
