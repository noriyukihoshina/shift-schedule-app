param(
    [string]$TargetPage = "index.html",
    [int]$Port = 38383,
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($scriptDir)) { $scriptDir = $PSScriptRoot }
if ([string]::IsNullOrWhiteSpace($scriptDir)) { $scriptDir = (Get-Location).Path }

# ルートフォルダおよびシステムフォルダのスマート解決
$rootDir = $scriptDir
if ((Split-Path -Leaf $scriptDir).ToLower() -eq "system") {
    $rootDir = Split-Path -Parent $scriptDir
}

# データフォルダ探索
$dataDir = Join-Path $rootDir "data"
if (-not (Test-Path $dataDir)) {
    if (Test-Path (Join-Path $scriptDir "data")) {
        $dataDir = Join-Path $scriptDir "data"
    } else {
        New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
    }
}

$prefix = "http://127.0.0.1:$Port/"

# ★ 1. 健全性チェック：既存サーバーが「実際にpingに応答するか」
$existingHealthy = $false
try {
    $req = [System.Net.HttpWebRequest]::Create("${prefix}ping")
    $req.Timeout = 1000
    $req.Proxy = $null
    $resp = $req.GetResponse()
    $stream = $resp.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $text = $reader.ReadToEnd().Trim()
    $reader.Close()
    $resp.Close()
    if ($text -eq "pong") {
        $existingHealthy = $true
    }
} catch {
    $existingHealthy = $false
}

if ($existingHealthy) {
    # 既存サーバーが正常稼働中のため、そのままブラウザを開いて自身は終了
    if (-not $NoBrowser) {
        Start-Process "$prefix$TargetPage"
    }
    exit 0
}

# ★ 2. 応答がない（またはポート塞がり・ゾンビ化）の場合の自己修復クリーンアップ
# 自身以外の server.ps1 / local_server.ps1 プロセスをすべて安全に終了してポートを解放
$myPid = $PID
try {
    Get-CimInstance Win32_Process | Where-Object {
        $_.ProcessId -ne $myPid -and 
        $_.Name -eq "powershell.exe" -and 
        ($_.CommandLine -match "server\.ps1" -or $_.CommandLine -match "local_server\.ps1")
    } | ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Milliseconds 400
} catch {}

# ★ 3. ポート38383でリッスン開始（最大5回リトライ）
$listener = $null
for ($attempt = 1; $attempt -le 5; $attempt++) {
    try {
        $tempListener = New-Object System.Net.HttpListener
        $tempListener.Prefixes.Add($prefix)
        $tempListener.Start()
        $listener = $tempListener
        break
    } catch {
        Start-Sleep -Milliseconds 500
    }
}

if ($null -eq $listener) {
    # リッスンに失敗した場合はブラウザのみ開いて終了
    if (-not $NoBrowser) {
        Start-Process "$prefix$TargetPage"
    }
    exit 1
}

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  勤務表作成システム 院内共有フォルダデータサーバー  " -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "アクセスURL: $prefix$TargetPage" -ForegroundColor Green
Write-Host "データ保存先: $dataDir" -ForegroundColor Yellow

# ブラウザ起動（Windows標準の高速ローカル起動）
if (-not $NoBrowser) {
    Start-Process "$prefix$TargetPage"
}

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8";
    ".js"   = "application/javascript; charset=utf-8";
    ".css"  = "text/css; charset=utf-8";
    ".json" = "application/json; charset=utf-8";
    ".png"  = "image/png";
    ".jpg"  = "image/jpeg";
    ".svg"  = "image/svg+xml";
    ".ico"  = "image/x-icon"
}

$lastAccessTime = Get-Date
$asyncResult = $null

try {
    while ($listener.IsListening) {
        # ★ 決定的な修正：未完了の BeginGetContext がある間は新しく発行しない！
        if ($null -eq $asyncResult) {
            $asyncResult = $listener.BeginGetContext($null, $null)
        }

        # 2秒待機
        $signaled = $asyncResult.AsyncWaitHandle.WaitOne(2000)

        if (-not $signaled) {
            # 30分間アクセスがなければ自動終了（リソース解放）
            $idleMinutes = ((Get-Date) - $lastAccessTime).TotalMinutes
            if ($idleMinutes -ge 30) {
                Write-Host "30分間無操作のためサーバーを自動終了します。" -ForegroundColor Yellow
                break
            }
            continue
        }

        # リクエスト到着！コンテキスト取得＆asyncResultクリア
        $context = $listener.EndGetContext($asyncResult)
        $asyncResult = $null
        $lastAccessTime = Get-Date

        $request = $context.Request
        $response = $context.Response

        # CORS & キャッシュ無効化ヘッダー
        $response.Headers.Add("Access-Control-Allow-Origin", "*")
        $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type")
        $response.Headers.Add("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        $response.Headers.Add("Pragma", "no-cache")
        $response.Headers.Add("Expires", "0")

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 200
            $response.Close()
            continue
        }

        $path = $request.Url.LocalPath

        # ヘルスチェック
        if ($path -eq "/ping") {
            $pong = [System.Text.Encoding]::UTF8.GetBytes("pong")
            $response.StatusCode = 200
            $response.ContentType = "text/plain"
            $response.OutputStream.Write($pong, 0, $pong.Length)
            $response.Close()
            continue
        }

        # 終了コマンド
        if ($path -eq "/shutdown") {
            $pong = [System.Text.Encoding]::UTF8.GetBytes("ok")
            $response.StatusCode = 200
            $response.ContentType = "text/plain"
            $response.OutputStream.Write($pong, 0, $pong.Length)
            $response.Close()
            break
        }

        # API: /api/cloud_sync
        if ($path -eq "/api/cloud_sync") {
            try {
                if ($request.HttpMethod -eq "GET") {
                    $deptId = $request.QueryString["deptId"]
                    if ([string]::IsNullOrWhiteSpace($deptId)) { $deptId = "master" }
                    $deptId = ($deptId -replace '[^a-zA-Z0-9_-]', '').ToLower()
                    if ([string]::IsNullOrWhiteSpace($deptId)) { $deptId = "master" }

                    $filePath = Join-Path $dataDir "dept_${deptId}.json"
                    if (Test-Path $filePath) {
                        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
                        $jsonContent = [System.IO.File]::ReadAllText($filePath, $utf8NoBom).Trim()
                        if ($jsonContent.Length -gt 0 -and [int][char]$jsonContent[0] -eq 65279) {
                            $jsonContent = $jsonContent.Substring(1)
                        }
                        $respStr = "{`"ok`":true,`"deptId`":`"$deptId`",`"exists`":true,`"cloudState`":$jsonContent}"
                    } else {
                        $respStr = "{`"ok`":true,`"deptId`":`"$deptId`",`"exists`":false,`"cloudState`":null}"
                    }
                    $respBytes = [System.Text.Encoding]::UTF8.GetBytes($respStr)
                    $response.StatusCode = 200
                    $response.ContentType = "application/json; charset=utf-8"
                    $response.OutputStream.Write($respBytes, 0, $respBytes.Length)
                    $response.Close()
                    continue
                }

                if ($request.HttpMethod -eq "POST") {
                    $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                    $bodyStr = $reader.ReadToEnd()
                    $bodyObj = ConvertFrom-Json $bodyStr

                    $deptId = $bodyObj.deptId
                    if ([string]::IsNullOrWhiteSpace($deptId)) { $deptId = "master" }
                    $deptId = ($deptId -replace '[^a-zA-Z0-9_-]', '').ToLower()
                    if ([string]::IsNullOrWhiteSpace($deptId)) { $deptId = "master" }

                    $filePath = Join-Path $dataDir "dept_${deptId}.json"
                    $currentData = @{}
                    if (Test-Path $filePath) {
                        try {
                            $rawJson = (Get-Content -Path $filePath -Raw -Encoding UTF8)
                            if ($rawJson.Length -gt 0 -and [int][char]$rawJson[0] -eq 65279) { $rawJson = $rawJson.Substring(1) }
                            $currentData = ($rawJson | ConvertFrom-Json)
                        } catch {}
                    }

                    # プレースホルダー判定関数
                    function Test-IsPlaceholderName([string]$n) {
                        if ([string]::IsNullOrWhiteSpace($n)) { return $true }
                        $t = $n.Trim()
                        if ($t -in @('a','b','c','あ','い','う','テスト')) { return $true }
                        if ($t -like "スタッフ*") { return $true }
                        if ($t -like "訪問スタッフ*") { return $true }
                        if ($t -like "通所スタッフ*") { return $true }
                        if ($t -like "ハーフ*" -or $t -like "ハ1*" -or $t -like "ハ2*" -or $t -like "ハ3*" -or $t -like "ハ4*") { return $true }
                        if ($t -like "クラーク*" -or $t -like "通所トレ*") { return $true }
                        return $false
                    }

                    # 実名数カウント
                    $existingValidCount = 0
                    if ($currentData.staffMaster) {
                        foreach ($sm in $currentData.staffMaster) {
                            if (-not (Test-IsPlaceholderName $sm.name)) { $existingValidCount++ }
                        }
                    }
                    $incomingValidCount = 0
                    if ($bodyObj.staffMaster) {
                        foreach ($sm in $bodyObj.staffMaster) {
                            if (-not (Test-IsPlaceholderName $sm.name)) { $incomingValidCount++ }
                        }
                    }

                    $resolvedMaster = @()
                    if ($existingValidCount -gt 0 -and $incomingValidCount -lt $existingValidCount) {
                        # 既存の方が実名が多い場合、既存マスタを最優先維持し、プレースホルダーでない新規実名のみ反映
                        $resolvedMaster = @($currentData.staffMaster)
                        if ($bodyObj.staffMaster) {
                            for ($idx = 0; $idx -lt $bodyObj.staffMaster.Count; $idx++) {
                                $incName = $bodyObj.staffMaster[$idx].name
                                if ($idx -lt $resolvedMaster.Count) {
                                    if (-not (Test-IsPlaceholderName $incName)) {
                                        $resolvedMaster[$idx] = $bodyObj.staffMaster[$idx]
                                    }
                                }
                            }
                        }
                    } elseif ($bodyObj.staffMaster) {
                        $resolvedMaster = @($bodyObj.staffMaster)
                    } elseif ($currentData.staffMaster) {
                        $resolvedMaster = @($currentData.staffMaster)
                    }

                    $merged = [ordered]@{
                        deptId = $deptId
                        staffMaster = $resolvedMaster
                        lastActiveDate = if ($bodyObj.lastActiveDate) { $bodyObj.lastActiveDate } else { if ($currentData.lastActiveDate) { $currentData.lastActiveDate } else { "2026-04-01" } }
                        savedTerms = if ($bodyObj.savedTerms) { @($bodyObj.savedTerms) } else { if ($currentData.savedTerms) { @($currentData.savedTerms) } else { @() } }
                        terms = if ($currentData.terms) { $currentData.terms } else { [ordered]@{} }
                        updatedAt = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
                    }

                    if ($bodyObj.fullTermsMap) {
                        foreach ($prop in $bodyObj.fullTermsMap.psobject.Properties) {
                            $merged.terms | Add-Member -MemberType NoteProperty -Name $prop.Name -Value $prop.Value -Force
                        }
                    }
                    if ($bodyObj.termDate -and $bodyObj.termData) {
                        $tData = $bodyObj.termData
                        # ターム内のスタッフ名保護: 既存タームに実名があり、送信側がプレースホルダーの場合は実名をマージ維持
                        if ($merged.terms.$($bodyObj.termDate) -and $merged.terms.$($bodyObj.termDate).staffList -and $tData.staffList) {
                            $oldList = $merged.terms.$($bodyObj.termDate).staffList
                            for ($idx = 0; $idx -lt $tData.staffList.Count; $idx++) {
                                if ($idx -lt $oldList.Count -and (-not (Test-IsPlaceholderName $oldList[$idx].name))) {
                                    if (Test-IsPlaceholderName $tData.staffList[$idx].name) {
                                        $tData.staffList[$idx].name = $oldList[$idx].name
                                    }
                                }
                            }
                        }
                        $merged.terms | Add-Member -MemberType NoteProperty -Name $bodyObj.termDate -Value $tData -Force
                        if ($merged.savedTerms -notcontains $bodyObj.termDate) {
                            $merged.savedTerms += $bodyObj.termDate
                        }
                    }

                    # 安全なアトミック保存
                    $saveJson = ConvertTo-Json $merged -Depth 20
                    $uniqueId = [System.Guid]::NewGuid().ToString("N")
                    $tmpPath = "$filePath.tmp.$uniqueId"
                    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
                    [System.IO.File]::WriteAllText($tmpPath, $saveJson, $utf8NoBom)

                    $moved = $false
                    for ($att = 0; $att -lt 3; $att++) {
                        try {
                            Move-Item -Path $tmpPath -Destination $filePath -Force
                            $moved = $true
                            break
                        } catch {
                            Start-Sleep -Milliseconds (100 * ($att + 1))
                        }
                    }
                    if (-not $moved) {
                        [System.IO.File]::WriteAllText($filePath, $saveJson, $utf8NoBom)
                    }
                    if (Test-Path $tmpPath) {
                        Remove-Item -Path $tmpPath -Force -ErrorAction SilentlyContinue
                    }

                    $respObj = @{ ok = $true; deptId = $deptId; updatedAt = $merged.updatedAt }
                    $respBytes = [System.Text.Encoding]::UTF8.GetBytes((ConvertTo-Json $respObj))
                    $response.StatusCode = 200
                    $response.ContentType = "application/json; charset=utf-8"
                    $response.OutputStream.Write($respBytes, 0, $respBytes.Length)
                    $response.Close()
                    continue
                }
            } catch {
                $errObj = @{ ok = $false; error = $_.Exception.Message }
                $errBytes = [System.Text.Encoding]::UTF8.GetBytes((ConvertTo-Json $errObj))
                $response.StatusCode = 500
                $response.ContentType = "application/json; charset=utf-8"
                $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
                $response.Close()
                continue
            }
        }

        # ★ 静的ファイル探索（systemフォルダ、直下、rootDirの全てを探索）
        $reqPath = $path.TrimStart('/')
        if ([string]::IsNullOrWhiteSpace($reqPath)) { $reqPath = "index.html" }

        $candidates = @(
            (Join-Path (Join-Path $rootDir "system") $reqPath),
            (Join-Path (Join-Path $scriptDir "system") $reqPath),
            (Join-Path $scriptDir $reqPath),
            (Join-Path $rootDir $reqPath)
        )
        $filePath = $null
        foreach ($c in $candidates) {
            if (Test-Path $c -PathType Leaf) {
                $filePath = $c
                break
            }
        }

        if ($filePath -and (Test-Path $filePath -PathType Leaf)) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $cType = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.StatusCode = 200
            $response.ContentType = $cType
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.Close()
        } else {
            $errBytes = [System.Text.Encoding]::UTF8.GetBytes("File Not Found: $reqPath")
            $response.StatusCode = 404
            $response.ContentType = "text/plain; charset=utf-8"
            $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
            $response.Close()
        }
    }
} finally {
    if ($listener -and $listener.IsListening) {
        $listener.Stop()
        $listener.Close()
    }
}
