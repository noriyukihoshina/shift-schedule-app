$here = Get-Location

# solver.js と app.js の copyForExcel の HTML 生成を再現
$startCol = 'C'
$endCol = 'AD'

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Add()
$sheet = $wb.Sheets.Item(1)

# テストHTMLを作成してクリップボード経由でPaste
# またはHTMLを一時ファイルとして保存し、Excelで開く
$htmlFile = Join-Path $here "temp_paste_test.html"

# app.jsのcopyForExcel相当のHTMLを生成
$html = "<html><body><table>"
$html += "<tr><th>No</th><th>Name</th>"
for ($d = 1; $d -le 28; $d++) { $html += "<th>$d</th>" }
$html += "<th>Work</th><th>Off</th><th>Paid</th><th>Ref</th><th>Early</th><th>Late</th><th>Eve</th><th>H8</th></tr>"

for ($s = 0; $s -lt 50; $s++) {
    $rowNum = $s + 2  # row 2 is staff 1, row 3 is staff 2... wait!
    # In app.js:
    # row 1: title (rowspan 2 for No/Name, but header is 2 rows!)
    # row 2: date headers!
    # row 3: staff 1!
    # row 4: staff 2!
}

# 実際にapp.jsのcopyForExcelが生成するHTMLを完全再現してExcelで開いて各セルのValueとFormulaを確認
$wb.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
