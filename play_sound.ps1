# 確実な通知音鳴動スクリプト (MediaPlayer + SoundPlayer 二重安全方式)
try {
    Add-Type -AssemblyName PresentationCore
    $player = New-Object System.Windows.Media.MediaPlayer
    $player.Open([Uri]"C:\Windows\Media\Windows Ding.wav")
    Start-Sleep -Milliseconds 250
    $player.Volume = 0.5
    $player.Play()
    Start-Sleep -Milliseconds 1500
} catch {
    # フォールバック
    (New-Object System.Media.SoundPlayer "C:\Windows\Media\Windows Ding.wav").PlaySync()
}
