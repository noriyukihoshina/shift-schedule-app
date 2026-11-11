import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. renderMasterIntegrationView で masterTermSelect の値を最優先取得
old_master_date = "const curStartDate = document.getElementById('termStartDate')?.value || currentWorkingStartDate || '2026-04-01';"
new_master_date = "const curStartDate = document.getElementById('masterTermSelect')?.value || document.getElementById('termStartDate')?.value || currentWorkingStartDate || '2026-04-01';"
text = text.replace(old_master_date, new_master_date)

# 2. コピペモードの全ボタン同期
old_copy_toggle = """            if (isCopyMode) {
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
            }"""

new_copy_toggle = """            const allCopyBtns = document.querySelectorAll('#copyModeToggleBtn, .copy-mode-btn');
            if (isCopyMode) {
                allCopyBtns.forEach(b => {
                    b.classList.remove('btn-outline-primary');
                    b.classList.add('btn-primary');
                    b.textContent = '📋 コピペモードON';
                });
                showToast('📋 コピペモードON: セルをクリックして選択・コピー、貼り付け先のセルをクリック（Ctrl+C / Ctrl+Vも利用可能）');
            } else {
                allCopyBtns.forEach(b => {
                    b.classList.remove('btn-primary');
                    b.classList.add('btn-outline-primary');
                    b.textContent = '📋 コピペモード';
                });
                if (selectedCopyCell) selectedCopyCell.classList.remove('copy-selected-cell');
                selectedCopyCell = null;
                clipboardSymbol = null;
                showToast('📋 コピペモードOFF');
            }"""

text = text.replace(old_copy_toggle, new_copy_toggle)

# 3. getTermInfo() で masterTermSelect の反映
# getTermInfo は currentWorkingStartDate を見ているので、masterTermSelect変更時に currentWorkingStartDate を更新済み
with open('app.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("SUCCESS: Updated master date read and copy button sync in app.js")
