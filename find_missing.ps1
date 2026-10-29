$sha1 = New-Object System.Security.Cryptography.SHA1Managed
$missing = @("1b4fc47a95cab42ae05b4a6f174de42b9693f66f","7131c7fb9c92272aee56d1911f02dfe907ae9a4d","f16b0f607a723058d4ea90ece76e0b6f2743670a","fd51d96b665bee0bce4b5e38d6031b07b177e212")
Get-ChildItem -Path $PSScriptRoot -File | ForEach-Object {
    $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
    $hash = ($sha1.ComputeHash($bytes) | ForEach-Object { $_.ToString("x2") }) -join ""
    if ($missing -contains $hash) {
        Write-Output ("MATCH: " + $_.Name + " -> " + $hash)
    }
}
