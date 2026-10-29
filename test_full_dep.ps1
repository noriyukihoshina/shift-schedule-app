$targetPath = $PSScriptRoot
$cfg = Get-Content "C:\Users\coffe\Music\Antigravity\.deploy_config.json" -Raw | ConvertFrom-Json
$vcToken = $cfg.vercel.token
$vcTeam = $cfg.vercel.teamId

$sha1 = New-Object System.Security.Cryptography.SHA1Managed
$deployFiles = @()
Get-ChildItem -Path $targetPath -File | Where-Object {
    $_.Name -match "^[a-zA-Z0-9_\-\.]+$" -and $_.Name -notmatch "^\.git|.*\.xlsm$|\.log$|\.ps1$|\.txt$|\.xlsx$|\.xls$|\.zip$|^dom_|^test_|^verify_out_|^run_test_|^_debug_|^setup_cloud_storage|^pv_|^zone_test_|^cloud_backup_|^cleaned_|^completed_survey_backup_|^final_survey_|^staff_survey"
} | ForEach-Object {
    $deployFiles += @{ FullName = $_.FullName; RelPath = $_.Name }
}

$fileMetadata = @()
$seenHashes = @{}
foreach ($f in $deployFiles) {
    $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
    $hashBytes = $sha1.ComputeHash($bytes)
    $hashStr = ($hashBytes | ForEach-Object { $_.ToString("x2") }) -join ""
    
    $fileMetadata += @{
        file = $f.RelPath
        sha = $hashStr
        size = $bytes.Length
    }
    
    if ($seenHashes.ContainsKey($hashStr)) { continue }
    $seenHashes[$hashStr] = $true
    
    $uploadHeaders = @{
        "Authorization" = "Bearer $vcToken"
        "x-vercel-digest" = $hashStr
        "Content-Type" = "application/octet-stream"
    }
    for ($att = 1; $att -le 5; $att++) {
        try {
            $null = Invoke-RestMethod -Uri "https://api.vercel.com/v2/files?teamId=$vcTeam" -Headers $uploadHeaders -Method Post -Body $bytes
            Start-Sleep -Milliseconds 40
            break
        } catch {
            $st = 0
            if ($_.Exception.Response) { $st = $_.Exception.Response.StatusCode.value__ }
            if ($st -eq 409) { break }
            if ($st -eq 429) { Start-Sleep -Milliseconds 2500 }
            else { Start-Sleep -Milliseconds 300 }
        }
    }
}

$deployBody = @{
    name = "shift-schedule-app"
    files = $fileMetadata
    target = "production"
    projectSettings = @{ framework = $null }
} | ConvertTo-Json -Depth 5

$vcHeaders = @{
    "Authorization" = "Bearer $vcToken"
    "Content-Type"  = "application/json"
}

try {
    $dep = Invoke-RestMethod -Uri "https://api.vercel.com/v13/deployments?teamId=$vcTeam" -Headers $vcHeaders -Method Post -Body $deployBody
    Write-Output ("DEPLOY_SUCCESS: " + $dep.id + " -> " + $dep.url)
} catch {
    Write-Output ("Status: " + $_.Exception.Response.StatusCode.value__)
    Write-Output ("ErrorDetails: " + $_.ErrorDetails.Message)
}
