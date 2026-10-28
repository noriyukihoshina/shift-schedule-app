$urls = @(
    "https://shift-schedule-app-ruby.vercel.app",
    "https://shift-schedule-app-ruby.vercel.app/ST",
    "https://shift-schedule-app-ruby.vercel.app/1f",
    "https://shift-schedule-app-ruby.vercel.app/2f",
    "https://shift-schedule-app-ruby.vercel.app/3f",
    "https://shift-schedule-app-ruby.vercel.app/south",
    "https://shift-schedule-app-ruby.vercel.app/master"
)

foreach ($u in $urls) {
    try {
        $res = Invoke-WebRequest -Uri $u -Method Get -UseBasicParsing -MaximumRedirection 5
        Write-Output "$($res.StatusCode) OK : $u"
    } catch {
        Write-Output "ERR : $u -> $_"
    }
}
