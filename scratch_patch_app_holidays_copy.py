import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. renderOutputTable の公休セル網掛け（Line 4690 と Line 4723 付近）
old_unassigned_off = '<td class="stat-cell" data-s="${s}" data-stat="off">${staffStat.offDays}</td>'
new_unassigned_off = '<td class="stat-cell ${(!staff.isUnused && staffStat.offDays !== 8) ? \'holiday-alert-cell\' : \'\'}" data-s="${s}" data-stat="off" title="${staffStat.offDays !== 8 ? \'公休が8日ではありません（現在:\' + staffStat.offDays + \'日）\' : \'公休8日\'}">${staffStat.offDays}</td>'

assert old_unassigned_off in text, "old_unassigned_off not found"
text = text.replace(old_unassigned_off, new_unassigned_off)

old_standard_off = """<td class="stat-cell ${rowBottomCls}" data-s="${s}" data-stat="off" style="font-weight:700; color:#1e293b; background:transparent;">${staffStat.offDays}</td>"""
new_standard_off = """<td class="stat-cell ${rowBottomCls} ${(!staff.isUnused && staffStat.offDays !== 8) ? 'holiday-alert-cell' : ''}" data-s="${s}" data-stat="off" title="${staffStat.offDays !== 8 ? '公休が8日ではありません（現在:' + staffStat.offDays + '日）' : '公休8日'}" style="font-weight:700; color:#1e293b;">${staffStat.offDays}</td>"""

assert old_standard_off in text, "old_standard_off not found"
text = text.replace(old_standard_off, new_standard_off)

# 2. コピペモードの改修:
# セルクリック時は自動コピー・自動貼り付けをせず、純粋にセル選択（青枠ハイライト）のみ行う！
old_copy_click = """                // ★ コピペモード時の処理
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
                }"""

new_copy_click = """                // ★ ユーザー指示: コピペモード時のクリックは「セルの選択（フォーカス）」のみ！
                // セルクリックでの勝手なコピーや貼り付けは完全廃止し、Excel同様に Ctrl+C でコピー、Ctrl+V で貼り付けを行う
                if (isCopyMode) {
                    if (selectedCopyCell) selectedCopyCell.classList.remove('copy-selected-cell');
                    selectedCopyCell = cell;
                    cell.classList.add('copy-selected-cell');
                    // パレット記号等の直接入力を阻止
                    return;
                }"""

assert old_copy_click in text, "old_copy_click not found"
text = text.replace(old_copy_click, new_copy_click)

# 3. コピペモードのトースト文言
old_toast_copy = "showToast('📋 コピペモードON: セルをクリックして選択・コピー、貼り付け先のセルをクリック（Ctrl+C / Ctrl+Vも利用可能）');"
new_toast_copy = "showToast('📋 コピペモードON: セルをクリックして選択し、Ctrl+C でコピー、Ctrl+V で貼り付けを行ってください');"

if old_toast_copy in text:
    text = text.replace(old_toast_copy, new_toast_copy)

# 4. キーボードショートカット Ctrl+C / Ctrl+V の実装
old_keydown = """    // キーボードショートカット Ctrl+C / Ctrl+V
    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
            const activeCell = document.querySelector('.copy-selected-cell') || (document.activeElement && document.activeElement.classList.contains('day-cell') ? document.activeElement : null);
            if (activeCell) {
                clipboardSymbol = activeCell.textContent.trim();
                showToast(`📋 【${clipboardSymbol || '空欄'}】をコピーしました (Ctrl+C)`);
                e.preventDefault();
            }
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
            const activeCell = document.querySelector('.copy-selected-cell') || (document.activeElement && document.activeElement.classList.contains('day-cell') ? document.activeElement : null);
            if (activeCell && clipboardSymbol !== null) {
                activeCell.click(); // クリックイベントを発火して貼り付け適用
                e.preventDefault();
            }
        }
    });"""

new_keydown = """    // キーボードショートカット Ctrl+C / Ctrl+V
    // ★ ユーザー指示: クリックによる誤貼り付けを廃止し、Ctrl+Cでコピー、Ctrl+Vで貼り付けを確実に実行
    window.addEventListener('keydown', (e) => {
        if (!isCopyMode) return;
        const activeCell = selectedCopyCell || document.querySelector('.copy-selected-cell') || (document.activeElement && document.activeElement.classList.contains('day-cell') ? document.activeElement : null);
        
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
            if (activeCell) {
                clipboardSymbol = activeCell.textContent.trim();
                showToast(`📋 【${clipboardSymbol || '空欄'}】をコピーしました (Ctrl+C)`);
                e.preventDefault();
            }
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
            if (activeCell && clipboardSymbol !== null) {
                const s = parseInt(activeCell.dataset.s, 10);
                const type = activeCell.dataset.type;
                pushHistory();
                let newSym = clipboardSymbol;
                if (!isNaN(s) && staffList[s]) {
                    if (type === 'day') {
                        const d = parseInt(activeCell.dataset.d, 10);
                        if (!isNaN(d)) staffList[s].days[d] = newSym;
                    } else if (type === 'prev') {
                        const p = parseInt(activeCell.dataset.p, 10);
                        if (!isNaN(p)) staffList[s].prevDays[p] = newSym;
                    }
                }
                activeCell.textContent = newSym;
                if (typeof renderStatsDashboard === 'function' && lastSolveResult && lastSolveResult.stats) {
                    // リアルタイム再計算
                }
                saveCurrentTermToStorage();
                showToast(`📋 【${newSym || '空欄'}】を貼り付けました (Ctrl+V)`);
                e.preventDefault();
            }
        }
    });"""

assert old_keydown in text, "old_keydown not found"
text = text.replace(old_keydown, new_keydown)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("SUCCESS: app.js patched with holiday alerts and Ctrl+C/Ctrl+V copy mode!")
