const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, 'app.js');
let code = fs.readFileSync(appJsPath, 'utf8');

// 1. 重複している旧 copyForExcel の削除
// 探索パターン: function copyForExcel(grid, stats) { const term = getTermInfo(); const startCol = 'C'; ... }
const duplicateStart = code.indexOf("\n    function copyForExcel(grid, stats) {\r\n        const term = getTermInfo();\r\n        const startCol = 'C';");
const altDuplicateStart = duplicateStart !== -1 ? duplicateStart : code.indexOf("\n    function copyForExcel(grid, stats) {\n        const term = getTermInfo();\n        const startCol = 'C';");

if (altDuplicateStart !== -1) {
    const endMarker = "showToast('📋 コピー完了！Excelを開いて Ctrl + V で貼り付けてください');\r\n    }";
    const altEndMarker = "showToast('📋 コピー完了！Excelを開いて Ctrl + V で貼り付けてください');\n    }";
    let duplicateEnd = code.indexOf(endMarker, altDuplicateStart);
    let markerLen = endMarker.length;
    if (duplicateEnd === -1) {
        duplicateEnd = code.indexOf(altEndMarker, altDuplicateStart);
        markerLen = altEndMarker.length;
    }

    if (duplicateEnd !== -1) {
        // 重複部分（古い copyForExcel と 重複している fallbackCopyText）を削除
        code = code.substring(0, altDuplicateStart) + code.substring(duplicateEnd + markerLen);
        console.log("重複した旧 copyForExcel を正常に削除しました。");
    } else {
        console.warn("duplicateEnd が見つかりませんでした。");
    }
} else {
    console.log("重複した旧 copyForExcel は既に削除されているか、見つかりませんでした。");
}

// 2. exportExcelBtn, checkExportExcelBtn, exportExcelSpreadsheet の置き換え
const exportSearchStr = "    // 4. スプレッドシート（.xls）エクスポート（UTF-8 BOM付き）";
const exportStart = code.indexOf(exportSearchStr);

const initStaffStr = "    // 初期起動（直前に作業していた期間、または保存データを自動復元）";
const exportEnd = code.indexOf(initStaffStr);

if (exportStart !== -1 && exportEnd !== -1) {
    const newExportCode = `    // 4. スプレッドシート（.xls）エクスポート（A3横向き・全集計行・ST自動追従数式対応）
    const exportExcelBtn = document.getElementById('exportExcelBtn');
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', () => {
            safeExportExcel();
        });
    }

    const checkExportExcelBtn = document.getElementById('checkExportExcelBtn');
    if (checkExportExcelBtn) {
        checkExportExcelBtn.addEventListener('click', () => {
            safeExportExcel();
        });
    }

    function safeExportExcel() {
        try {
            let gridToExport = null;
            let statsToExport = null;

            if (lastSolveResult && lastSolveResult.grid) {
                gridToExport = lastSolveResult.grid;
                statsToExport = lastSolveResult.stats;
            } else if (lastScheduler && lastScheduler.grid) {
                gridToExport = lastScheduler.grid;
                statsToExport = lastScheduler.calculateStats();
            } else {
                const term = getTermInfo();
                const stdVal = parseFloat(document.getElementById('standardHolidaySelect')?.value || '8.0');
                const scheduler = new ShiftScheduler(staffList, {
                    standardHolidays: stdVal,
                    dates: term.dates,
                    dayOffsets: [...dayOffsets]
                });
                gridToExport = scheduler.grid;
                statsToExport = scheduler.calculateStats();
            }

            exportExcelSpreadsheet(gridToExport, statsToExport);
        } catch (err) {
            console.error('Excelエクスポートエラー:', err);
            showToast('⚠️ Excel出力中にエラーが発生しました: ' + err.message);
        }
    }

    function exportExcelSpreadsheet(grid, stats) {
        const term = getTermInfo();
        const tableHtml = generateExcelTableHtml(grid, stats);

        let html = \`\\uFEFF<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<!--[if gte mso 9]>
<xml>
 <x:ExcelWorkbook>
  <x:ExcelWorksheets>
   <x:ExcelWorksheet>
    <x:Name>\${term.title}</x:Name>
    <x:WorksheetOptions>
     <x:Print>
      <x:ValidPrinterInfo/>
      <x:PaperSizeIndex>8</x:PaperSizeIndex> <!-- A3用紙 -->
      <x:Scale>80</x:Scale>
      <x:HorizontalResolution>600</x:HorizontalResolution>
      <x:VerticalResolution>600</x:VerticalResolution>
     </x:Print>
     <x:Selected/>
     <x:Panes></x:Panes>
     <x:ProtectContents>False</x:ProtectContents>
     <x:ProtectObjects>False</x:ProtectObjects>
     <x:ProtectScenarios>False</x:ProtectScenarios>
    </x:WorksheetOptions>
   </x:ExcelWorksheet>
  </x:ExcelWorksheets>
 </x:ExcelWorkbook>
</xml>
<![endif]-->
<style>
  @page {
    size: A3 landscape;
    margin: 5mm;
    mso-page-orientation: landscape;
  }
  body {
    font-family: "Meiryo", "Yu Gothic", sans-serif;
    font-size: 10pt;
    margin: 0;
    padding: 10px;
    background-color: #ffffff;
  }
  table {
    border-collapse: collapse;
  }
  th, td {
    padding: 4px;
    vertical-align: middle;
  }
</style>
</head>
<body>
\${tableHtml}
</body>
</html>\`;

        const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', \`\${term.title}.xls\`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('📊 Excelファイルをダウンロードしました！（A3横向き・動的数式付き）');
    }

`;

    code = code.substring(0, exportStart) + newExportCode + code.substring(exportEnd);
    console.log("exportExcelSpreadsheet を新仕様に正常更新しました。");
} else {
    console.warn("exportStart または exportEnd が見つかりませんでした。");
}

fs.writeFileSync(appJsPath, code, 'utf8');
console.log("app.js の書き込みが完了しました。");
