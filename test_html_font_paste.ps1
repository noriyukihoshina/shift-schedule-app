Add-Type -AssemblyName System.Windows.Forms

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$wb = $excel.Workbooks.Add()
$ws = $wb.Worksheets.Item(1)

# テストするHTMLスニペット
$tests = @(
    @{ Name = "CSS Meiryo single quote"; Html = "<table border='1'><tr><td style=""font-family:'Meiryo';"">○ テスト1</td></tr></table>" },
    @{ Name = "CSS Meiryo no quote"; Html = "<table border='1'><tr><td style=""font-family:Meiryo;"">○ テスト2</td></tr></table>" },
    @{ Name = "CSS Yu Gothic"; Html = "<table border='1'><tr><td style=""font-family:'Yu Gothic';"">○ テスト3</td></tr></table>" },
    @{ Name = "CSS MS Gothic"; Html = "<table border='1'><tr><td style=""font-family:'ＭＳ Ｐゴシック';"">○ テスト4</td></tr></table>" },
    @{ Name = "font face tag"; Html = "<table border='1'><tr><td><font face=""Meiryo"">○ テスト5</font></td></tr></table>" },
    @{ Name = "mso font style"; Html = "<table border='1'><tr><td style=""mso-ascii-font-family:Meiryo; mso-fareast-font-family:Meiryo; font-family:Meiryo;"">○ テスト6</td></tr></table>" },
    @{ Name = "table font style"; Html = "<table border='1' style=""font-family:Meiryo;""><tr><td>○ テスト7</td></tr></table>" }
)

$row = 1
foreach ($t in $tests) {
    [System.Windows.Forms.Clipboard]::SetText($t.Html, [System.Windows.Forms.TextDataFormat]::Html)
    Start-Sleep -Milliseconds 200
    
    $ws.Cells.Item($row, 1).Select()
    $ws.Paste()
    
    $c = $ws.Cells.Item($row, 1)
    $fontName = $c.Font.Name
    $val = $c.Text
    Write-Output "$($t.Name): FontName='$fontName', Value='$val'"
    $row += 2
}

$wb.Close($false)
$excel.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
