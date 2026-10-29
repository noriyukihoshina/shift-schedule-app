$cfg = Get-Content "C:\Users\coffe\Music\Antigravity\.deploy_config.json" -Raw | ConvertFrom-Json
$vcToken = $cfg.vercel.token
$vcTeam = $cfg.vercel.teamId

$vcHeaders = @{
    "Authorization" = "Bearer $vcToken"
    "Content-Type"  = "application/json"
}

# test minimal deploy request
$deployBody = @{
    name = "shift-schedule-app"
    files = @()
    target = "production"
    projectSettings = @{ framework = $null }
} | ConvertTo-Json -Depth 5

try {
    $dep = Invoke-RestMethod -Uri "https://api.vercel.com/v13/deployments?teamId=$vcTeam" -Headers $vcHeaders -Method Post -Body $deployBody
    Write-Output "SUCCESS"
} catch {
    Write-Output ("Status: " + $_.Exception.Response.StatusCode.value__)
    Write-Output ("ErrorDetails: " + $_.ErrorDetails.Message)
}
