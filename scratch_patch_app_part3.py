import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. ドラッグ＆ドロップイベントリスナーの実装
# renderInputTable の最後（イベント付与部分）に追加
drag_event_logic = """
        // ★ ユーザー指示: 希望入力画面でスタッフの並び替え（ドラッグ＆ドロップ）
        let draggedIndex = null;
        tbody.querySelectorAll('tr[draggable="true"]').forEach(row => {
            row.addEventListener('dragstart', (e) => {
                draggedIndex = parseInt(row.dataset.s, 10);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', draggedIndex);
                row.classList.add('dragging-row');
            });

            row.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                row.classList.add('drag-over-row');
            });

            row.addEventListener('dragleave', () => {
                row.classList.remove('drag-over-row');
            });

            row.addEventListener('drop', (e) => {
                e.preventDefault();
                row.classList.remove('drag-over-row');
                const targetIndex = parseInt(row.dataset.s, 10);
                if (draggedIndex !== null && targetIndex !== null && draggedIndex !== targetIndex) {
                    pushHistory();
                    const movedItem = staffList.splice(draggedIndex, 1)[0];
                    staffList.splice(targetIndex, 0, movedItem);
                    // No再付番（idを1〜Nに整列）
                    staffList.forEach((st, idx) => {
                        st.id = idx + 1;
                    });
                    saveCurrentTermToStorage();
                    renderInputTable();
                    showToast(`📋 スタッフの並び順を更新しました（No.${draggedIndex + 1} ➔ No.${targetIndex + 1}）`);
                }
            });

            row.addEventListener('dragend', () => {
                row.classList.remove('dragging-row');
                tbody.querySelectorAll('.drag-over-row').forEach(r => r.classList.remove('drag-over-row'));
                draggedIndex = null;
            });
        });
"""

# renderInputTable の tbody.innerHTML 設定直後にドラッグイベントを登録
if "tbody.querySelectorAll('tr[draggable=\"true\"]')" not in text:
    old_input_render_end = "tbody.innerHTML = bodyHtml;"
    new_input_render_end = "tbody.innerHTML = bodyHtml;\n" + drag_event_logic
    text = text.replace(old_input_render_end, new_input_render_end, 1)
    print("SUCCESS: Registered drag-and-drop event listeners in renderInputTable")

# 2. コピペモードのトグル＆セルクリック＆Ctrl+C/Ctrl+Vイベント
copy_paste_full_code = """
    // ★ ユーザー指示: コピペモード（セル選択 Ctrl+C / Ctrl+V またはクリック貼付）
    document.addEventListener('click', (e) => {
        const toggleBtn = e.target.closest('#copyModeToggleBtn, .copy-mode-btn');
        if (toggleBtn) {
            isCopyMode = !isCopyMode;
            if (isCopyMode) {
                toggleBtn.classList.remove('btn-outline-primary');
                toggleBtn.classList.add('btn-primary');
                toggleBtn.textContent = '📋 コピペモードON';
                showToast('📋 コピペモードON: セルをクリックして選択・コピー、貼り付け先のセルをクリック（Ctrl+C / Ctrl+Vも利用可能）');
            } else {
                toggleBtn.classList.remove('btn-primary');
                toggleBtn.classList.add('btn-outline-primary');
                toggleBtn.textContent = '📋 コピペモード';
                if (selectedCopyCell) selectedCopyCell.classList.remove('copy-selected-cell');
                selectedCopyCell = null;
                clipboardSymbol = null;
                showToast('📋 コピペモードOFF');
            }
        }
    });

    // キーボードショートカット Ctrl+C / Ctrl+V
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
    });
"""

if "window.addEventListener('keydown', (e) => {" not in text:
    text += "\n" + copy_paste_full_code
    print("SUCCESS: Added copy-paste mode keyboard and toggle handlers")

# 3. マスターテーブルのターム選択連動
master_term_logic = """
    // ★ ユーザー指示: マスターテーブルでもPOテーブルのようにタームを指定可能にする
    function initMasterTermSelect() {
        const masterSel = document.getElementById('masterTermSelect');
        if (!masterSel) return;
        masterSel.innerHTML = '';
        GLOBAL_TERMS.forEach(term => {
            const opt = document.createElement('option');
            opt.value = term.startDate;
            opt.textContent = term.label;
            if (term.startDate === currentWorkingStartDate) opt.selected = true;
            masterSel.appendChild(opt);
        });

        masterSel.addEventListener('change', (e) => {
            const newStart = e.target.value;
            currentWorkingStartDate = newStart;
            localStorage.setItem('shift_schedule_current_start_date', newStart);
            showToast(`📅 マスターテーブル: ${masterSel.options[masterSel.selectedIndex].text} に切り替えました`);
            // マスター統合再描画
            if (typeof renderMasterIntegrationView === 'function') {
                renderMasterIntegrationView();
            }
        });
    }
    // DOM初期化時に呼び出し
    setTimeout(initMasterTermSelect, 100);
"""

if "function initMasterTermSelect()" not in text:
    text += "\n" + master_term_logic
    print("SUCCESS: Added masterTermSelect initialization and change handler")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("SUCCESS: Part 3 of app.js updated successfully")
