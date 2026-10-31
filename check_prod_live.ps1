$resp = Invoke-WebRequest -Uri "https://shift-schedule-app-ruby.vercel.app" -UseBasicParsing
if ($resp.Content.Contains("rev87")) {
    Write-Host "PROD LIVE CONFIRMED: rev87 deployed successfully!" -ForegroundColor Green
} else {
    Write-Host "PROD NOT YET UPDATED" -ForegroundColor Yellow
}
