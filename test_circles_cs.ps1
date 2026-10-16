Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class ExcelTester {
    public static void Run() {
        Type excelType = Type.GetTypeFromProgID("Excel.Application");
        dynamic excel = Activator.CreateInstance(excelType);
        excel.Visible = false;
        dynamic wb = excel.Workbooks.Add();
        dynamic ws = wb.Worksheets[1];

        // 1. U+25CB in Arial 10
        ws.Cells[1, 1].Value2 = "U+25CB (White Circle)";
        ws.Cells[1, 2].Value2 = "\u25CB";
        ws.Cells[1, 2].Font.Name = "Arial";
        ws.Cells[1, 2].Font.Size = 10;

        // 2. U+3007 in Arial 10
        ws.Cells[2, 1].Value2 = "U+3007 (Kanji Zero)";
        ws.Cells[2, 2].Value2 = "\u3007";
        ws.Cells[2, 2].Font.Name = "Arial";
        ws.Cells[2, 2].Font.Size = 10;

        // 3. U+25EF in Arial 10
        ws.Cells[3, 1].Value2 = "U+25EF (Large Circle)";
        ws.Cells[3, 2].Value2 = "\u25EF";
        ws.Cells[3, 2].Font.Name = "Arial";
        ws.Cells[3, 2].Font.Size = 10;

        // 4. U+25CB in Meiryo 10
        ws.Cells[4, 1].Value2 = "U+25CB in Meiryo";
        ws.Cells[4, 2].Value2 = "\u25CB";
        ws.Cells[4, 2].Font.Name = "Meiryo";
        ws.Cells[4, 2].Font.Size = 10;

        // 数式テスト: COUNTIF
        ws.Cells[6, 1].Formula = "=COUNTIF(B1:B3, \"\u25CB\")";
        ws.Cells[6, 2].Formula = "=COUNTIF(B1:B3, \"\u3007\")";
        ws.Cells[6, 3].Formula = "=COUNTIF(B1:B3, \"\u25EF\")";
        ws.Cells[6, 4].Formula = "=COUNTIF(B1:B3, \"*\u25CB*\") + COUNTIF(B1:B3, \"*\u3007*\")";

        string outPath = System.IO.Path.Combine(System.Environment.CurrentDirectory, "test_excel_circles_result.xlsx");
        wb.SaveAs(outPath);
        wb.Close(false);
        excel.Quit();
        Marshal.ReleaseComObject(excel);
        Console.WriteLine("SUCCESS: Saved to " + outPath);
    }
}
"@

[ExcelTester]::Run()
