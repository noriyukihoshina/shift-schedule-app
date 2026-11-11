import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 入力シートのセルクリック処理へのコピペモード組み込み
old_cell_click_inp = """        document.querySelectorAll('.day-cell').forEach(cell => {
            cell.addEventListener('click', (e) => {
                const s = parseInt(cell.dataset.s, 10);
                const type = cell.dataset.type;

                let newSym = getActivePaletteSymbol(false);"""

new_cell_click_inp = """        document.querySelectorAll('.day-cell').forEach(cell => {
            cell.addEventListener('click', (e) => {
                const s = parseInt(cell.dataset.s, 10);
                const type = cell.dataset.type;

                // ★ コピペモード時の処理
                if (isCopyMode) {
                    if (clipboardSymbol === null || selectedCopyCell === null) {
                        // コピー
                        clipboardSymbol = cell.textContent.trim();
                        if (selectedCopyCell) selectedCopyCell.classList.remove('copy-selected-cell');
                        selectedCopyCell = cell;
                        cell.classList.add('copy-selected-cell');
                        showToast(`📋 【${clipboardSymbol || '空欄'}】をコピーしました。貼り付け先をクリックしてください`);
                        return;
                    } else {
                        // 貼り付け
                        let newSym = clipboardSymbol;
                        pushHistory();
                        if (type === 'day') {
                            const d = parseInt(cell.dataset.d, 10);
                            staffList[s].days[d] = newSym;
                        } else if (type === 'prev') {
                            const p = parseInt(cell.dataset.p, 10);
                            staffList[s].prevDays[p] = newSym;
                        }
                        cell.textContent = newSym;
                        saveCurrentTermToStorage();
                        showToast(`📋 【${newSym || '空欄'}】を貼り付けました`);
                        return;
                    }
                }

                let newSym = getActivePaletteSymbol(false);"""

text = text.replace(old_cell_click_inp, new_cell_click_inp, 1)

# 出力シート（修正作業エリア）のセルクリック処理へのコピペモード組み込み
old_cell_click_out = """                const s = parseInt(cell.dataset.s, 10);
                const d = parseInt(cell.dataset.d, 10);
                if (!lastSolveResult || !lastSolveResult.grid) return;

                // ★ P（プロテクト）ボタンが選択されている場合: 固定保護のトグル切り替え"""

new_cell_click_out = """                const s = parseInt(cell.dataset.s, 10);
                const d = parseInt(cell.dataset.d, 10);
                if (!lastSolveResult || !lastSolveResult.grid) return;

                // ★ コピペモード時の処理（出力シート/修正作業エリア）
                if (isCopyMode) {
                    if (clipboardSymbol === null || selectedCopyCell === null) {
                        clipboardSymbol = cell.textContent.trim();
                        if (selectedCopyCell) selectedCopyCell.classList.remove('copy-selected-cell');
                        selectedCopyCell = cell;
                        cell.classList.add('copy-selected-cell');
                        showToast(`📋 【${clipboardSymbol || '空欄'}】をコピーしました。貼り付け先をクリックしてください`);
                        return;
                    } else {
                        pushHistory();
                        const cellData = lastSolveResult.grid[s][d];
                        cellData.symbol = clipboardSymbol;
                        if (lastScheduler) {
                            lastScheduler.grid[s][d].symbol = clipboardSymbol;
                            const newStats = lastScheduler.calculateStats();
                            lastSolveResult.stats = newStats;
                            renderOutputTable(lastSolveResult.grid, newStats);
                            renderStatsDashboard(newStats);
                        } else {
                            renderOutputTable(lastSolveResult.grid, lastSolveResult.stats);
                        }
                        saveCurrentTermToStorage();
                        showToast(`📋 【${clipboardSymbol || '空欄'}】を貼り付けました`);
                        return;
                    }
                }

                // ★ P（プロテクト）ボタンが選択されている場合: 固定保護のトグル切り替え"""

text = text.replace(old_cell_click_out, new_cell_click_out, 1)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("SUCCESS: Implemented copy mode into day-cell click handlers for both input and output tables.")
