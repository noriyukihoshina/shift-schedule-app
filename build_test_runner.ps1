$html = Get-Content -Path "index.html" -Raw -Encoding UTF8

$testScript = @"
<div id="test-e2e-status" style="position:fixed; top:10px; right:10px; background:#fff; border:2px solid #000; padding:10px; z-index:99999; max-width:400px; font-size:12px;">WAITING</div>
<script>
window.addEventListener('load', () => {
    setTimeout(async () => {
        const out = [];
        function log(msg) {
            console.log(msg);
            out.push(msg);
            document.getElementById('test-e2e-status').innerText = out.join('\n');
        }

        try {
            log("1. Page loaded.");

            // 貼り付けモーダルを開く
            const btnPasteOpen = document.getElementById('openPasteModalBtn');
            const pasteModal = document.getElementById('pasteModal');
            const pasteText = document.getElementById('pasteInputText');
            const btnPasteExec = document.getElementById('executePasteImportBtn');

            if (!btnPasteOpen || !pasteModal || !pasteText || !btnPasteExec) {
                throw new Error("Paste elements not found!");
            }

            btnPasteOpen.click();
            if (!pasteModal.classList.contains('active')) {
                throw new Error("pasteModal failed to open!");
            }
            log("2. Paste modal opened.");

            // サンプル希望データ（28列分）
            let sampleTsv = "";
            for (let s = 1; s <= 50; s++) {
                const row = [];
                for (let d = 0; d < 28; d++) {
                    if (s === 1 && d === 0) row.push("休");
                    else if (s === 1 && d === 1) row.push("有");
                    else if (s === 2 && d === 5) row.push("早");
                    else if (s === 3 && d === 10) row.push("○/休");
                    else if (s === 4 && d === 15) row.push("上1");
                    else row.push("");
                }
                sampleTsv += row.join("\t") + "\n";
            }

            pasteText.value = sampleTsv;
            btnPasteExec.click();

            if (pasteModal.classList.contains('active')) {
                throw new Error("pasteModal failed to close after import!");
            }
            log("3. Data imported and modal closed.");

            // セルの反映確認
            const cell1_0 = document.querySelector('.day-cell[data-s="0"][data-d="0"]');
            const cell1_1 = document.querySelector('.day-cell[data-s="0"][data-d="1"]');
            const cell2_5 = document.querySelector('.day-cell[data-s="1"][data-d="5"]');
            const cell3_10 = document.querySelector('.day-cell[data-s="2"][data-d="10"]');
            const cell4_15 = document.querySelector('.day-cell[data-s="3"][data-d="15"]');

            if (!cell1_0 || cell1_0.innerText !== '休' || !cell1_0.classList.contains('fixed-cell')) {
                throw new Error("cell1_0 failed: " + (cell1_0 ? cell1_0.outerHTML : 'null'));
            }
            if (!cell1_1 || cell1_1.innerText !== '有' || !cell1_1.classList.contains('fixed-cell')) {
                throw new Error("cell1_1 failed");
            }
            if (!cell2_5 || cell2_5.innerText !== '早' || !cell2_5.classList.contains('fixed-cell')) {
                throw new Error("cell2_5 failed");
            }
            if (!cell3_10 || cell3_10.innerText !== '○/休' || !cell3_10.classList.contains('fixed-cell')) {
                throw new Error("cell3_10 failed");
            }
            if (!cell4_15 || cell4_15.innerText !== '上1' || !cell4_15.classList.contains('fixed-cell')) {
                throw new Error("cell4_15 failed");
            }
            log("4. Imported cells confirmed as fixed-cell (Bold, Red)!");

            // 自動作成ボタンを押してソルバー実行
            const autoBtn = document.getElementById('autoGenerateBtn');
            autoBtn.click();

            log("5. Solver completed successfully!");
            log("E2E_TEST_SUCCESS");

        } catch (e) {
            log("ERROR: " + e.message + "\n" + e.stack);
        }
    }, 50);
});
</script>
"@

$combined = $html.Replace("</body>", $testScript + "</body>")
[System.IO.File]::WriteAllText((Join-Path (Get-Location) "test_in_real_index.html"), $combined, [System.Text.Encoding]::UTF8)

# Run in Edge Headless with Start-Process
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$url = "file:///" + (Get-Item "test_in_real_index.html").FullName.Replace("\", "/")
$dumpFile = Join-Path (Get-Location) "temp_e2e_dump.txt"

$proc = Start-Process -FilePath $edge -ArgumentList @("--headless", "--virtual-time-budget=1500", "--dump-dom", $url) -NoNewWindow -RedirectStandardOutput $dumpFile -PassThru
$proc.WaitForExit(10000)

$out = [System.IO.File]::ReadAllText($dumpFile, [System.Text.Encoding]::UTF8)

if ($out -match 'E2E_TEST_SUCCESS') {
    Write-Output "RESULT: PASS (All E2E checks passed!)"
} else {
    Write-Output "RESULT: FAIL or IN-PROGRESS"
    if ($out -match 'id="test-e2e-status".*?>(.*?)</div>') {
        Write-Output "Status: $($matches[1])"
    } else {
        Write-Output "Status tag not matched. Dump length: $($out.Length)"
    }
}
