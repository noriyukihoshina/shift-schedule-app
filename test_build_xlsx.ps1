$tempDir = "$PWD\temp_xlsx"
if (!(Test-Path $tempDir)) {
    New-Item -ItemType Directory -Path "$tempDir\_rels" -Force | Out-Null
    New-Item -ItemType Directory -Path "$tempDir\xl\_rels" -Force | Out-Null
    New-Item -ItemType Directory -Path "$tempDir\xl\worksheets" -Force | Out-Null
}

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
  <fonts count="1">
    <font><sz val="11"/><name val="游ゴシック"/></font>
  </fonts>
  <fills count="2">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
  </cellXfs>
</styleSheet>
'@
[System.IO.File]::WriteAllText("$tempDir\xl\styles.xml", $styles, [System.Text.Encoding]::UTF8)

$sheet1 = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews>
    <sheetView tabSelected="1" workbookViewId="0"/>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <sheetData>
    <row r="1">
      <c r="A1" t="inlineStr"><is><t>No</t></is></c>
      <c r="B1" t="inlineStr"><is><t>氏名</t></is></c>
      <c r="C1" t="inlineStr"><is><t>4/1(水)</t></is></c>
      <c r="D1" t="inlineStr"><is><t>4/2(木)</t></is></c>
    </row>
    <row r="2">
      <c r="A2"><v>1</v></c>
      <c r="B2" t="inlineStr"><is><t>佐藤 健一</t></is></c>
      <c r="C2" t="inlineStr"><is><t>休</t></is></c>
      <c r="D2"/>
    </row>
  </sheetData>
  <dataValidations count="1">
    <dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" sqref="C2:D51">
      <formula1>&quot;休,有,○,出,早,遅,E,8時,○/休,休/○,○/有,有/○,上1,上2,上3,上4,上5,下1,下2,下3&quot;</formula1>
    </dataValidation>
  </dataValidations>
</worksheet>
'@
[System.IO.File]::WriteAllText("$tempDir\xl\worksheets\sheet1.xml", $sheet1, [System.Text.Encoding]::UTF8)

Add-Type -AssemblyName System.IO.Compression.FileSystem
$destZip = "$PWD\test_pv_result.xlsx"
if (Test-Path $destZip) { [System.IO.File]::Delete($destZip) }
[System.IO.Compression.ZipFile]::CreateFromDirectory($tempDir, $destZip)

# Excel COMで開いて検証
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$wb = $excel.Workbooks.Open($destZip)
$sheet = $wb.Sheets.Item(1)
$valA1 = $sheet.Range("A1").Text
$valC2 = $sheet.Range("C2").Text
$valType = $sheet.Range("C2").Validation.Type
$valFormula = $sheet.Range("C2").Validation.Formula1
$wb.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null

Write-Host "RESULT: A1=$valA1, C2=$valC2, ValidationType=$valType, Formula=$valFormula"
