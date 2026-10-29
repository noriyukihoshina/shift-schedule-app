$targetHash = "e10e9af0354bcda955c1e89fbdf109f49d1126bf"
$files = Get-ChildItem -Path $PSScriptRoot -Recurse -File
$sha = [System.Security.Cryptography.SHA1]::Create()
foreach ($f in $files) {
    if ($f.FullName -match "\.git") { continue }
    $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
    $h = ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace("-","").ToLower()
    if ($h -eq $targetHash) {
        Write-Host "MATCH: $($f.FullName) (Size: $($bytes.Length))"
    }
}
