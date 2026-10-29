$dir = $PSScriptRoot

# Unicode characters: 🖨️ (U+1F5A8, U+FE0F), 印刷 (\u5370\u5237), 勤務表を印刷します
$printTitle = [char]0x52E4 + [char]0x52D9 + [char]0x8868 + [char]0x3092 + [char]0x5370 + [char]0x5237 + [char]0x3057 + [char]0x307E + [char]0x3059
$printLabel = [char]::ConvertFromUtf32(0x1F5A8) + [char]0xFE0F + " " + [char]0x5370 + [char]0x5237

$printBtnHtml = @"
            <button type="button" class="global-print-btn no-print" onclick="window.print()" title="$printTitle" style="background: #2563eb; color: #ffffff; border: 1px solid #1d4ed8; padding: 4px 14px; border-radius: 9999px; font-size: 0.82rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
                $printLabel
            </button>
"@

$htmlFiles = Get-ChildItem -Path $dir -Filter "*.html"

foreach ($f in $htmlFiles) {
    $c = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
    if (-not ($c -match 'class="global-print-btn')) {
        if ($c -match 'id="manualCloudSyncBtn"') {
            $c = $c -replace '(id="manualCloudSyncBtn"[^>]*>[\s\S]*?<\/button>)', "`$1`r`n$printBtnHtml"
            [System.IO.File]::WriteAllText($f.FullName, $c, [System.Text.Encoding]::UTF8)
            Write-Output "Added print button to $($f.Name)"
        }
    }
}
Write-Output "Done adding print buttons."
