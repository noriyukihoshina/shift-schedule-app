$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) { $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }

$pages = @("ST.html", "1f.html", "2f.html", "3f.html", "south.html", "master.html", "index.html")

$allPassed = $true

foreach ($pg in $pages) {
    $p = Join-Path $dir $pg
    $guid = [Guid]::NewGuid().ToString("N")
    $urlArg = "file:///" + $p + "?v=" + $guid

    $content = & $edge --headless --disable-gpu --virtual-time-budget=2000 --dump-dom $urlArg | Out-String

    # autoSaveStatusBadge のテキスト確認
    $mBadge = [System.Text.RegularExpressions.Regex]::Match($content, 'id="autoSaveStatusText"[^>]*>(.*?)</span>')
    $badgeText = if ($mBadge.Success) { $mBadge.Groups[1].Value.Trim() } else { "NOT FOUND" }

    # script タグのバージョン確認
    $mRev = [System.Text.RegularExpressions.Regex]::Match($content, 'solver\.js\?v=([^"]+)')
    $revText = if ($mRev.Success) { $mRev.Groups[1].Value } else { "NOT FOUND" }

    # エラーモーダルの表示確認
    $hasModalError = $content.Contains('予期せぬエラーが発生しました') || $content.Contains('ShiftScheduler is not defined')

    Write-Output "[$pg] Rev: $revText | Badge: $badgeText | ModalError: $hasModalError"

    if ($hasModalError -or $revText -ne "20261029_rev59") {
        $allPassed = $false
        Write-Output "  -> FAILED for $pg"
    } else {
        Write-Output "  -> PASSED"
    }
}

if ($allPassed) {
    Write-Output "`n>>> ALL 7 PRODUCTION PAGES VERIFIED PERFECTLY! (100% SUCCESS)"
} else {
    Write-Output "`n>>> SOME PAGES FAILED"
}
