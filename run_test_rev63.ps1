$htmlPath = "file:///C:/Users/coffe/OneDrive/デスクトップ/Antigravity/勤務表作成/test_rev63_comprehensive.html"
$outPath = "C:\Users\coffe\OneDrive\デスクトップ\Antigravity\勤務表作成\test_rev63_out.txt"

$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) {
    $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$proc = Start-Process -FilePath $edge -ArgumentList "--headless", "--disable-gpu", "--dump-dom", "$htmlPath" -NoNewWindow -PassThru -RedirectStandardOutput $outPath
$proc.WaitForExit(15000)

$content = [System.IO.File]::ReadAllText($outPath, [System.Text.Encoding]::UTF8)
Write-Host "--- TEST OUTPUT ---"
Write-Host $content
