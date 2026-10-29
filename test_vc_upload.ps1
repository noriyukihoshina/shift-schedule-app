$filePath = Join-Path $PSScriptRoot "app.js"
$bytes = [System.IO.File]::ReadAllBytes($filePath)
$sha1 = New-Object System.Security.Cryptography.SHA1Managed
$hashStr = ($sha1.ComputeHash($bytes) | ForEach-Object { $_.ToString("x2") }) -join ""
$cfg = Get-Content "C:\Users\coffe\Music\Antigravity\.deploy_config.json" -Raw | ConvertFrom-Json
$vcToken = $cfg.vercel.token
$vcTeam = $cfg.vercel.teamId

$headers = @{
    "Authorization" = "Bearer $vcToken"
    "x-vercel-digest" = $hashStr
    "Content-Type" = "application/octet-stream"
}
try {
    $res = Invoke-RestMethod -Uri "https://api.vercel.com/v2/files?teamId=$vcTeam" -Headers $headers -Method Post -Body $bytes
    Write-Output "Upload SUCCESS"
} catch {
    Write-Output ("Upload FAILED: " + $_.Exception.Message)
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        Write-Output ("Response body: " + $reader.ReadToEnd())
    }
}
