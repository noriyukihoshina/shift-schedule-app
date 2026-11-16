param(
    [string]$TargetPage = "index.html",
    [int]$Port = 38383,
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$rootDir = $PSScriptRoot
$dataDir = Join-Path $rootDir "data"
if (-not (Test-Path $dataDir)) {
    New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
}

$prefix = "http://127.0.0.1:$Port/"

# ポートが開いているか確認（すでに起動中ならブラウザだけ開いて終了）
$isAlreadyRunning = $false
try {
    $testReq = [System.Net.WebRequest]::Create("${prefix}ping")
    $testReq.Timeout = 1000
    $testResp = $testReq.GetResponse()
    $testResp.Close()
    $isAlreadyRunning = $true
} catch {
    $isAlreadyRunning = $false
}

if ($isAlreadyRunning) {
    if (-not $NoBrowser) {
        Start-Process "$prefix$TargetPage"
    }
    exit 0
}

# HttpListener の開始
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try {
    $listener.Start()
} catch {
    Write-Host "ポート $Port のリッスンに失敗しました: $_" -ForegroundColor Red
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
Write-Host "（このウィンドウを閉じるとローカルサーバーが終了します）" -ForegroundColor Gray

# ブラウザを自動起動
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

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        # CORS ヘッダー
        $response.Headers.Add("Access-Control-Allow-Origin", "*")
        $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type")

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 200
            $response.Close()
            continue
        }

        $rawUrl = $request.RawUrl
        $path = $request.Url.LocalPath

        # ヘルスチェック用 / 終了用
        if ($path -eq "/ping") {
            $pong = [System.Text.Encoding]::UTF8.GetBytes("pong")
            $response.StatusCode = 200
            $response.ContentType = "text/plain"
            $response.OutputStream.Write($pong, 0, $pong.Length)
            $response.Close()
            continue
        }
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
                        # 生のJSONをそのままレスポンスに埋め込んで高速・正確に返す
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
                            $currentData = (Get-Content -Path $filePath -Raw -Encoding UTF8 | ConvertFrom-Json)
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

                    # 保存（安全なアトミック書き込み）
                    $saveJson = ConvertTo-Json $merged -Depth 20
                    $tmpPath = "$filePath.tmp"
                    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
                    [System.IO.File]::WriteAllText($tmpPath, $saveJson, $utf8NoBom)
                    Move-Item -Path $tmpPath -Destination $filePath -Force

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
            $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
            $response.Close()
        }
    }
} finally {
    if ($listener.IsListening) {
        $listener.Stop()
    }
    $listener.Close()
}
