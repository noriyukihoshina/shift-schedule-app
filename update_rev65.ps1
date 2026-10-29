$dir = $PSScriptRoot
$htmlFiles = Get-ChildItem -Path $dir -Filter '*.html'
$count = 0
foreach ($f in $htmlFiles) {
    $content = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
    if ($content -match 'rev64') {
        $newContent = $content -replace 'rev64', 'rev65'
        [System.IO.File]::WriteAllText($f.FullName, $newContent, [System.Text.Encoding]::UTF8)
        $count++
        Write-Host ('Updated: ' + $f.Name)
    }
}
Write-Host ('Total files updated: ' + $count)
