Add-Type -AssemblyName System.IO.Compression.FileSystem

$tempDir = "$PWD\temp_full_xlsx"
if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
New-Item -ItemType Directory -Path "$tempDir\_rels" -Force | Out-Null
New-Item -ItemType Directory -Path "$tempDir\xl\_rels" -Force | Out-Null
New-Item -ItemType Directory -Path "$tempDir\xl\worksheets" -Force | Out-Null

$contentTypes = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>
'@
[System.IO.File]::WriteAllText("$tempDir\[Content_Types].xml", $contentTypes, [System.Text.Encoding]::UTF8)

$rels = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>
'@
[System.IO.File]::WriteAllText("$tempDir\_rels\.rels", $rels, [System.Text.Encoding]::UTF8)

$workbook = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="希望入力シート" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>
'@
[System.IO.File]::WriteAllText("$tempDir\xl\workbook.xml", $workbook, [System.Text.Encoding]::UTF8)

$wbRels = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>
'@
[System.IO.File]::WriteAllText("$tempDir\xl\_rels\workbook.xml.rels", $wbRels, [System.Text.Encoding]::UTF8)

$styles = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3">
    <font><sz val="10"/><name val="游ゴシック"/></font>
    <font><b/><sz val="10"/><name val="游ゴシック"/></font>
    <font><b/><color rgb="FFDC2626"/><sz val="10"/><name val="游ゴシック"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE0F2FE"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/></border>
    <border>
      <left style="thin"><color rgb="FFCBD5E1"/></left>
      <right style="thin"><color rgb="FFCBD5E1"/></right>
      <top style="thin"><color rgb="FFCBD5E1"/></top>
      <bottom style="thin"><color rgb="FFCBD5E1"/></bottom>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="4">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  </cellXfs>
</styleSheet>
'@
[System.IO.File]::WriteAllText("$tempDir\xl\styles.xml", $styles, [System.Text.Encoding]::UTF8)

# 28日分の日付列ヘッダー生成 (L列=12 〜 AM列=39)
# 50名分の行データ生成
$rows = @()
$hCells = @()
$hCells += '<c r="A2" s="1" t="inlineStr"><is><t>No</t></is></c>'
$hCells += '<c r="B2" s="1" t="inlineStr"><is><t>氏名</t></is></c>'
$hCells += '<c r="C2" s="1" t="inlineStr"><is><t>8時可(1/0)</t></is></c>'
$hCells += '<c r="D2" s="1" t="inlineStr"><is><t>早不可(1/0)</t></is></c>'
$hCells += '<c r="E2" s="1" t="inlineStr"><is><t>遅不可(1/0)</t></is></c>'
$hCells += '<c r="F2" s="1" t="inlineStr"><is><t>E不可(1/0)</t></is></c>'
$hCells += '<c r="G2" s="1" t="inlineStr"><is><t>前5</t></is></c>'
$hCells += '<c r="H2" s="1" t="inlineStr"><is><t>前4</t></is></c>'
$hCells += '<c r="I2" s="1" t="inlineStr"><is><t>前3</t></is></c>'
$hCells += '<c r="J2" s="1" t="inlineStr"><is><t>前2</t></is></c>'
$hCells += '<c r="K2" s="1" t="inlineStr"><is><t>前1</t></is></c>'

function Get-ColName([int]$colIndex) {
    $colName = ""
    while ($colIndex -gt 0) {
        $mod = ($colIndex - 1) % 26
        $colName = [char](65 + $mod) + $colName
        $colIndex = [Math]::Floor(($colIndex - $mod) / 26)
    }
    return $colName
}

for ($d = 0; $d -lt 28; $d++) {
    $col = Get-ColName (12 + $d)
    $day = $d + 1
    $hCells += "<c r=`"${col}2`" s=`"1`" t=`"inlineStr`"><is><t>4/$day</t></is></c>"
}
$hCells += '<c r="AN2" s="2" t="inlineStr"><is><t>希望休数</t></is></c>'
$hCells += '<c r="AO2" s="2" t="inlineStr"><is><t>希望有休数</t></is></c>'
$hCells += '<c r="AP2" s="1" t="inlineStr"><is><t>備考</t></is></c>'

$headerRowXml = "<row r=`"2`">$($hCells -join '')</row>"
$rows += $headerRowXml

for ($s = 1; $s -le 50; $s++) {
    $r = $s + 2
    $cells = @()
    $cells += "<c r=`"A$r`" s=`"3`"><v>$s</v></c>"
    $cells += "<c r=`"B$r`" s=`"0`" t=`"inlineStr`"><is><t>スタッフ $s</t></is></c>"
    $cells += "<c r=`"C$r`" s=`"3`"><v>$(if ($s -le 9) { 1 } else { 0 })</v></c>"
    $cells += "<c r=`"D$r`" s=`"3`"><v>0</v></c>"
    $cells += "<c r=`"E$r`" s=`"3`"><v>0</v></c>"
    $cells += "<c r=`"F$r`" s=`"3`"><v>0</v></c>"
    $cells += "<c r=`"G$r`" s=`"3`" t=`"inlineStr`"><is><t>○</t></is></c>"
    $cells += "<c r=`"H$r`" s=`"3`" t=`"inlineStr`"><is><t>○</t></is></c>"
    $cells += "<c r=`"I$r`" s=`"3`" t=`"inlineStr`"><is><t>休</t></is></c>"
    $cells += "<c r=`"J$r`" s=`"3`" t=`"inlineStr`"><is><t>○</t></is></c>"
    $cells += "<c r=`"K$r`" s=`"3`" t=`"inlineStr`"><is><t>○</t></is></c>"

    for ($d = 0; $d -lt 28; $d++) {
        $col = Get-ColName (12 + $d)
        $cells += "<c r=`"${col}${r}`" s=`"3`"/>"
    }

    $fOff = "=COUNTIF(L$r:AM$r,`"休`")+0.5*(COUNTIF(L$r:AM$r,`"○/休`")+COUNTIF(L$r:AM$r,`"休/○`"))"
    $fPaid = "=COUNTIF(L$r:AM$r,`"有`")+0.5*(COUNTIF(L$r:AM$r,`"○/有`")+COUNTIF(L$r:AM$r,`"有/○`"))"

    $cells += "<c r=`"AN$r`" s=`"3`"><f>$fOff</f></c>"
    $cells += "<c r=`"AO$r`" s=`"3`"><f>$fPaid</f></c>"
    $cells += "<c r=`"AP$r`" s=`"0`"/>"

    $rows += "<row r=`"$r`">$($cells -join '')</row>"
}

$sheetDataXml = $rows -join "`n"

$sheet1Xml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView tabSelected="1" workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>
    <col min="1" max="1" width="5" customWidth="1"/>
    <col min="2" max="2" width="14" customWidth="1"/>
    <col min="3" max="6" width="9" customWidth="1"/>
    <col min="7" max="11" width="5" customWidth="1"/>
    <col min="12" max="39" width="6" customWidth="1"/>
    <col min="40" max="41" width="10" customWidth="1"/>
    <col min="42" max="42" width="12" customWidth="1"/>
  </cols>
  <sheetData>
    <row r="1">
      <c r="B1" t="inlineStr"><is><t>2026/04/01～2026/04/28 希望勤務入力シート (セルをクリックしてプルダウンから希望記号を選択してください。空白は通常日勤)</t></is></c>
    </row>
    $sheetDataXml
  </sheetData>
  <dataValidations count="1">
    <dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" sqref="L3:AM52">
      <formula1>&quot;休,有,○,出,早,遅,E,8時,○/休,休/○,○/有,有/○,上1,上2,上3,上4,上5,下1,下2,下3&quot;</formula1>
    </dataValidation>
  </dataValidations>
  <pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>
</worksheet>
"@

[System.IO.File]::WriteAllText("$tempDir\xl\worksheets\sheet1.xml", $sheet1Xml, [System.Text.Encoding]::UTF8)

$outXlsx = "$PWD\test_full_template.xlsx"
if (Test-Path $outXlsx) { Remove-Item $outXlsx -Force }
[System.IO.Compression.ZipFile]::CreateFromDirectory($tempDir, $outXlsx)

# Excel COMで開いて検証
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$wb = $excel.Workbooks.Open($outXlsx)
$sheet = $wb.Sheets.Item(1)
$valA2 = $sheet.Range("A2").Text
$valB3 = $sheet.Range("B3").Text
$valL3Type = $sheet.Range("L3").Validation.Type
$valL3Formula = $sheet.Range("L3").Validation.Formula1
$valAM52Type = $sheet.Range("AM52").Validation.Type
$valAN3Formula = $sheet.Range("AN3").Formula
$wb.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null

Write-Host "TEST FULL SUCCESS: A2=$valA2, B3=$valB3, L3Type=$valL3Type, AM52Type=$valAM52Type, AN3Formula=$valAN3Formula"
