param(
    [string]$TargetPage = "index.html",
    [int]$StartPort = 38383,
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($rootDir)) {
    $rootDir = $PSScriptRoot
}
if ([string]::IsNullOrWhiteSpace($rootDir)) {
    $rootDir = (Get-Location).Path
}

$dataDir = Join-Path $rootDir "data"
if (-not (Test-Path $dataDir)) {
    New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
}

# ポート探索 (38383 から 38389 まで自動探索)
$selectedPort = 0
$listener = $null

for ($p = $StartPort; $p -lt ($StartPort + 10); $p++) {
    $testPrefix = "http://127.0.0.1:$p/"
    
    # 既存サーバーが稼働中か確認
    $isRunning = $false
    try {
        $req = [System.Net.WebRequest]::Create("${testPrefix}ping")
        $req.Timeout = 500
        $resp = $req.GetResponse()
        $resp.Close()
        $isRunning = $true
    } catch {
        $isRunning = $false
    }

    if ($isRunning) {
        # 既存サーバーがすでに動いているので、そのサーバーを使ってブラウザを開くだけ
        Write-Host "既存の共有サーバーが稼働中です (ポート: $p)" -ForegroundColor Cyan
        if (-not $NoBrowser) {
            Start-Process "$testPrefix$TargetPage"
        }
        exit 0
    }

    # 新規にリッスンを試みる
    try {
        $tempListener = New-Object System.Net.HttpListener
        $tempListener.Prefixes.Add($testPrefix)
        $tempListener.Start()
        $selectedPort = $p
        $listener = $tempListener
        break
    } catch {
        # ポート使用中のため次を試す
        if ($tempListener) {
            try { $tempListener.Close() } catch {}
        }
    }
}

if (-not $listener) {
    Write-Host "エラー: 使用可能なポートが見つかりませんでした。" -ForegroundColor Red
    exit 1
}

$prefix = "http://127.0.0.1:$selectedPort/"

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  勤務表作成システム 院内共有フォルダデータサーバー  " -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "アクセスURL: $prefix$TargetPage" -ForegroundColor Green
Write-Host "データ保存先: $dataDir" -ForegroundColor Yellow
Write-Host "（このウィンドウを最小化してお使いください）" -ForegroundColor Gray

# ブラウザ自動起動
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

try {
    while ($listener.IsListening) {
        # 非同期待機（5秒タイムアウトでアイドル監視）
        $asyncContext = $listener.BeginGetContext($null, $null)
        $signaled = $asyncContext.AsyncWaitHandle.WaitOne(5000)

        if (-not $signaled) {
            # 30分間アクセスがなければ自動終了（PCリソース解放）
            $idleMinutes = ((Get-Date) - $lastAccessTime).TotalMinutes
            if ($idleMinutes -ge 30) {
                Write-Host "30分間無操作のためサーバーを自動終了します。" -ForegroundColor Yellow
                break
            }
            continue
        }

        $context = $listener.EndGetContext($asyncContext)
        $request = $context.Request
        $response = $context.Response
        $lastAccessTime = Get-Date

        # キャッシュ無効化 ＆ CORS ヘッダー
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
                        # 先頭BOMの念押し除去
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

                    # マージ
                    $merged = [ordered]@{
                        deptId = $deptId
                        staffMaster = if ($bodyObj.staffMaster) { @($bodyObj.staffMaster) } else { if ($currentData.staffMaster) { @($currentData.staffMaster) } else { @() } }
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
                        $merged.terms | Add-Member -MemberType NoteProperty -Name $bodyObj.termDate -Value $bodyObj.termData -Force
                        if ($merged.savedTerms -notcontains $bodyObj.termDate) {
                            $merged.savedTerms += $bodyObj.termDate
                        }
                    }

                    # 安全なアトミック保存（GUID付き一時ファイル ＆ 最大3回リトライ）
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
                        # フォールバック直接上書き
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

        # 静的ファイル配信
        $reqPath = $path.TrimStart('/')
        if ([string]::IsNullOrWhiteSpace($reqPath)) { $reqPath = "index.html" }
        $filePath = Join-Path $rootDir $reqPath

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $cType = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.StatusCode = 200
            $response.ContentType = $cType
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.Close()
        } else {
            $response.StatusCode = 404
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
