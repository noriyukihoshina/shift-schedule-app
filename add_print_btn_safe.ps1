$dir = $PSScriptRoot
$printBtnHtml = "<button type=""button"" class=""global-print-btn no-print"" onclick=""window.print()"" title=""勤務表を印刷します"" style=""background: #2563eb; color: #ffffff; border: 1px solid #1d4ed8; padding: 4px 14px; border-radius: 9999px; font-size: 0.82rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.1);"">🖨️ 印刷</button>"

$htmlFiles = Get-ChildItem -Path $dir -Filter "*.html" | Where-Object { $_.Name -match "^[a-zA-Z0-9_\-\.]+$" -or $_.Name -match "マスター|生活期|病棟" }

foreach ($f in $htmlFiles) {
    $c = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
    if (-not ($c.Contains("global-print-btn"))) {
        $c = $c -replace '(id="manualCloudSyncBtn"[^>]*>[\s\S]*?<\/button>)', "`$1`r`n            $printBtnHtml"
        [System.IO.File]::WriteAllText($f.FullName, $c, [System.Text.Encoding]::UTF8)
        Write-Output "Added print button to $($f.Name)"
    }
}
