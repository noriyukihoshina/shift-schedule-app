$resp = Invoke-WebRequest -Uri "https://shift-schedule-app-ruby.vercel.app" -UseBasicParsing
$resp.Content | Select-String -Pattern "rev\d+"
