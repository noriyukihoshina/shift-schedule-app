$targetPath = $PSScriptRoot
$cfg = Get-Content "C:\Users\coffe\Music\Antigravity\.deploy_config.json" -Raw | ConvertFrom-Json
$vcToken = $cfg.vercel.token
$vcTeam = $cfg.vercel.teamId

$sha1 = New-Object System.Security.Cryptography.SHA1Managed
$missing = @("1b4fc47a95cab42ae05b4a6f174de42b9693f66f","7131c7fb9c92272aee56d1911f02dfe907ae9a4d","f16b0f607a723058d4ea90ece76e0b6f2743670a","fd51d96b665bee0bce4b5e38d6031b07b177e212")

Get-ChildItem -Path $targetPath -File | ForEach-Object {
    $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
    $hash = ($sha1.ComputeHash($bytes) | ForEach-Object { $_.ToString("x2") }) -join ""
    if ($missing -contains $hash) {
        Write-Output ("Uploading missing: " + $_.Name + " (" + $hash + ")")
        $headers = @{
            "Authorization" = "Bearer $vcToken"
            "x-vercel-digest" = $hash
            "Content-Type" = "application/octet-stream"
        }
        try {
            $null = Invoke-RestMethod -Uri "https://api.vercel.com/v2/files?teamId=$vcTeam" -Headers $headers -Method Post -Body $bytes
            Write-Output " -> OK"
        } catch {
            Write-Output (" -> FAIL: " + $_.Exception.Message + " " + $_.ErrorDetails.Message)
        }
    }
}
