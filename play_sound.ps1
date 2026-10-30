Add-Type -AssemblyName PresentationCore
$m = New-Object System.Windows.Media.MediaPlayer
$m.Open([System.Uri]"C:\Windows\Media\Windows Ding.wav")
$m.Volume = 0.25
$m.Play()
Start-Sleep -Milliseconds 2000
