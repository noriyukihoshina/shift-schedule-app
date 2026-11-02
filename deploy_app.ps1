param(
    [Parameter(Mandatory=$true)]
    [string]$AppDir,

    [Parameter(Mandatory=$true)]
    [string]$AppName
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Tri-Lock Verified Deployment System   " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if ([string]::IsNullOrWhiteSpace($AppDir) -or [string]::IsNullOrWhiteSpace($AppName)) {
    Write-Error "ABORT: -AppDir and -AppName must be explicitly specified!"
    exit 1
}

$currentDir = $PSScriptRoot
$parentDir = Split-Path $currentDir -Parent

if ($AppDir -ne "勤務表作成" -and $AppDir -ne ".") {
    Write-Error "ABORT: Target directory mismatch: $AppDir"
    exit 1
}
$targetDir = $currentDir

Write-Host "[1/4] Running Tri-Lock Verification Gate..." -ForegroundColor Yellow

$metaPath = Join-Path $targetDir ".app_meta.json"
if (-not (Test-Path $metaPath)) {
    Write-Error "ABORT Gate 1: .app_meta.json not found in $targetDir"
    exit 1
}
$meta = Get-Content $metaPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($meta.appName -ne $AppName) {
    Write-Error "ABORT Gate 1: appName mismatch! Expected '$AppName', but found '$($meta.appName)' in .app_meta.json"
    exit 1
}
Write-Host "  -> Gate 1 Passed: appName '$AppName' matches .app_meta.json" -ForegroundColor Green

$regPath = Join-Path $parentDir "deploy_registry.json"
if (-not (Test-Path $regPath)) {
    $regPath = Join-Path $targetDir "deploy_registry.json"
}
$registry = Get-Content $regPath -Raw -Encoding UTF8 | ConvertFrom-Json
$regProj = $registry.projects.$AppName
if (-not $regProj) {
    Write-Error "ABORT Gate 2: Project '$AppName' not registered in deploy_registry.json"
    exit 1
}
Write-Host "  -> Gate 2 Passed: Project '$AppName' matched registry master definition" -ForegroundColor Green

$indexHtmlPath = Join-Path $targetDir "index.html"
if (-not (Test-Path $indexHtmlPath)) {
    Write-Error "ABORT Gate 3: index.html not found in $targetDir"
    exit 1
}
$indexContent = Get-Content $indexHtmlPath -Raw -Encoding UTF8
if (-not ($indexContent -match "勤務|シフト|Schedule")) {
    Write-Error "ABORT Gate 3: Mandatory keywords not found in index.html"
    exit 1
}
if ($indexContent -match "バレーボール|ローテーション|アンケート|English") {
    Write-Error "ABORT Gate 3: Forbidden keyword from other app detected in index.html!"
    exit 1
}
Write-Host "  -> Gate 3 Passed: Keyword and collision isolation verified" -ForegroundColor Green
Write-Host "ALL TRI-LOCK VERIFICATION GATES PASSED!" -ForegroundColor Green

Write-Host "`n[2/4] Loading Deployment Credentials..." -ForegroundColor Yellow
$cfgPath = Join-Path $parentDir ".deploy_config.json"
if (-not (Test-Path $cfgPath)) {
    $cfgPath = Join-Path $targetDir ".deploy_config.json"
}
$cfg = Get-Content $cfgPath -Raw -Encoding UTF8 | ConvertFrom-Json
$vcToken = $cfg.vercel.token
$vcTeam  = $cfg.vercel.teamId

Write-Host "`n[3/4] Preparing Files & Uploading to Vercel..." -ForegroundColor Yellow

$includeExtensions = @(".html", ".js", ".css", ".json", ".png", ".jpg", ".svg", ".ico", ".xlsx")
$allFiles = Get-ChildItem -Path $targetDir -Recurse -File | Where-Object {
    $rel = $_.FullName.Substring($targetDir.Length + 1).Replace('\', '/')
    $ext = $_.Extension.ToLower()
    $name = $_.Name
    
    if (-not ($includeExtensions -contains $ext)) { return $false }
    if ($rel -match '^(temp_|sample_|\.git|\.system_generated)') { return $false }
    if ($name -match '^(test_|verify_|dump_|check_|inspect_|res_|_test_|_debug_|debug_)') { return $false }
    if ($name -match '[\u3000-\u9fff\u3040-\u30ff]') { return $false }
    if ($ext -eq ".xlsx" -and ($name -match '^[0-9a-z]{8}\.' -or $name -match '^(pv_|output_|zone_|step1_)')) { return $false }
    if ($ext -eq ".js" -and ($name -match '^(gen_|diff_|fix_|update_|swap_|run_test_|comprehensive_|find_sheet1|cleanup_|add_)')) { return $false }
    if ($name -match '(_dom_|^dom_)') { return $false }
    
    return $true
}

Write-Host "Target clean files to deploy: $($allFiles.Count) files"

$sha1 = [System.Security.Cryptography.SHA1]::Create()
$fileMetadata = @()
$uploadedCount = 0

foreach ($f in $allFiles) {
    $relPath = $f.FullName.Substring($targetDir.Length + 1).Replace('\', '/')
    $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
    $hashBytes = $sha1.ComputeHash($bytes)
    $hashStr = ($hashBytes | ForEach-Object { $_.ToString("x2") }) -join ""

    $uploadHeaders = @{
        "Authorization"   = "Bearer $vcToken"
        "x-vercel-digest" = $hashStr
        "Content-Type"    = "application/octet-stream"
    }

    try {
        $null = Invoke-RestMethod -Uri "https://api.vercel.com/v2/files?teamId=$vcTeam" -Headers $uploadHeaders -Method Post -Body $bytes
        $uploadedCount++
    } catch {
        # 409 already exists is normal
    }

    $fileMetadata += @{
        file = $relPath
        sha  = $hashStr
        size = $bytes.Length
    }
}
Write-Host "  -> Processed $($fileMetadata.Count) files (Uploaded: $uploadedCount new)" -ForegroundColor Green

Write-Host "`n[4/4] Creating Vercel Production Deployment..." -ForegroundColor Yellow
$deployObj = @{
    name            = $AppName
    files           = $fileMetadata
    target          = "production"
    projectSettings = @{ framework = $null }
}
$deployJson = $deployObj | ConvertTo-Json -Depth 6
$deployBytes = [System.Text.Encoding]::UTF8.GetBytes($deployJson)

$vcHeaders = @{
    "Authorization" = "Bearer $vcToken"
    "Content-Type"  = "application/json; charset=utf-8"
}

$dep = Invoke-RestMethod -Uri "https://api.vercel.com/v13/deployments?teamId=$vcTeam" -Headers $vcHeaders -Method Post -Body $deployBytes

Write-Host "Deployment created! ID: $($dep.id)"
Write-Host "Waiting for deployment readiness..."
$depId = $dep.id
$ready = $false
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 2
    $check = Invoke-RestMethod -Uri "https://api.vercel.com/v11/deployments/$depId`?teamId=$vcTeam" -Headers $vcHeaders -Method Get
    Write-Host "  State: $($check.readyState)"
    if ($check.readyState -eq "READY") {
        $ready = $true
        break
    }
}

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "          DEPLOY SUCCESSFUL!            " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "Project: $AppName"
Write-Host "Deployment ID: $depId"
Write-Host "Public URL: https://shift-schedule-app-ruby.vercel.app"
Write-Host "========================================" -ForegroundColor Green