$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) {
    $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}
$dir = $PSScriptRoot
$url = "file:///" + ($dir.Replace('\', '/') + "/3f.html")
$domFile = Join-Path $dir ("dom_3f_" + [System.Guid]::NewGuid().ToString("N") + ".html")

$p = Start-Process -FilePath $edge -ArgumentList "--headless=new", "--dump-dom", $url -RedirectStandardOutput $domFile -NoNewWindow -PassThru
Start-Sleep -Seconds 6
if (-not $p.HasExited) {
    Stop-Process -Id $p.Id -Force
}
Start-Sleep -Milliseconds 500

if (Test-Path $domFile) {
    $c = [System.IO.File]::ReadAllText($domFile, [System.Text.Encoding]::UTF8)
    Write-Host "Contains 🌸 : $($c.Contains('🌸'))"
    Write-Host "Contains 【3F 所属 STスタッフ : $($c.Contains('【3F 所属 STスタッフ'))"
    Write-Host "Contains st-linked-row : $($c.Contains('st-linked-row'))"
    Write-Host "Contains PT A 出勤 : $($c.Contains('PT A 出勤'))"
}
