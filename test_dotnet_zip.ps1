Add-Type -AssemblyName System.IO.Compression.FileSystem
$p = Join-Path (Get-Location) "test_export_generated.xlsx"
try {
    $zip = [System.IO.Compression.ZipFile]::OpenRead($p)
    Write-Output "DotNet Zip can read it! Entries count: $($zip.Entries.Count)"
    foreach ($e in $zip.Entries) {
        Write-Output "  $($e.FullName) (Comp: $($e.CompressedLength), Orig: $($e.Length))"
    }
    $zip.Dispose()
} catch {
    Write-Output "DotNet Zip error: $($_.Exception.Message)"
}
