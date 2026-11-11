import sys
sys.stdout.reconfigure(encoding='utf-8')
import re

# 1. life.html の更新
with open('life.html', 'r', encoding='utf-8') as f:
    life_html = f.read()

# 「特殊勤務を入れる」ボタンの削除
# 例: <button id="assignSpecialsBtn" ...>特殊勤務を入れる</button> や類似ボタン
life_html = re.sub(r'<button[^>]*id=["\']?(?:assignSpecialsBtn|btnAssignSpecials)[^>]*>.*?特殊勤務.*?<\/button>', '', life_html, flags=re.DOTALL)
life_html = re.sub(r'<button[^>]*>.*?特殊勤務を入れる.*?<\/button>', '', life_html, flags=re.DOTALL)

with open('life.html', 'w', encoding='utf-8') as f:
    f.write(life_html)
print("SUCCESS: Cleaned special duty button from life.html")

# 2. master.html のターム選択プルダウン追加
with open('master.html', 'r', encoding='utf-8') as f:
    master_html = f.read()

if 'id="masterTermSelect"' not in master_html:
    # ツールバー内の適当な位置（年月選択やボタン付近）にターム選択を追加
    term_select_html = """
                <div class="d-inline-flex align-items-center me-3" style="gap:6px;">
                    <label for="masterTermSelect" style="font-weight:700; font-size:0.88rem; color:#334155; white-space:nowrap;">📅 対象ターム:</label>
                    <select id="masterTermSelect" class="form-select form-select-sm" style="width: auto; min-width: 240px; font-weight: 600;">
                    </select>
                </div>
    """
    # 例えば <div class="toolbar-actions"> や <div class="header-controls"> などに挿入
    if '<div class="header-controls' in master_html:
        master_html = master_html.replace('<div class="header-controls', term_select_html + '<div class="header-controls', 1)
        print("SUCCESS: Inserted masterTermSelect before header-controls in master.html")
    elif '<div class="d-flex align-items-center' in master_html:
        master_html = master_html.replace('<div class="d-flex align-items-center', term_select_html + '<div class="d-flex align-items-center', 1)
        print("SUCCESS: Inserted masterTermSelect in master.html")
    else:
        # body直下のメインコンテナ前
        master_html = re.sub(r'(<div class="card-header[^>]*>)', r'\1' + term_select_html, master_html, count=1)
        print("SUCCESS: Inserted masterTermSelect in card-header of master.html")

    with open('master.html', 'w', encoding='utf-8') as f:
        f.write(master_html)
else:
    print("masterTermSelect already present in master.html")

# 3. 全HTMLのパレットボタン「出」を「出張」に変更＆コピペモードボタン追加
html_files = [
    'index.html', '1f.html', '2f.html', '3f.html', 'south.html', 'st.html', 'ST.html', 'life.html', 'master.html',
    '1階病棟.html', '2階病棟.html', '3階病棟.html', '南病棟.html', '生活期.html', '生活期_管理者.html', 'マスターテーブル.html'
]

import os
for hf in html_files:
    if not os.path.exists(hf):
        continue
    with open(hf, 'r', encoding='utf-8') as f:
        content = f.read()

    # 「出」ボタンを「出張」に変更
    content = re.sub(r'(data-sym=["\'])出(["\'][^>]*title=["\'])出張(["\']>?)出(</button>)', r'\1出張\2出張\3出張\4', content)
    content = re.sub(r'(data-sym=["\'])出(["\']>?)出(</button>)', r'\1出張\2出張\3', content)

    # コピペモードボタンの追加（パレット群の最後に追加）
    copy_btn_html = '<button type="button" class="btn btn-sm btn-outline-primary copy-mode-btn" id="copyModeToggleBtn" style="font-weight:700; margin-left:8px; padding:2px 8px;" title="セルを選択してCtrl+Cでコピー、別セルでCtrl+Vまたはクリックで貼り付け">📋 コピペモード</button>'
    if 'copy-mode-btn' not in content:
        # class="palette-group" の閉じタグ </div> の直前に追加
        content = re.sub(r'(<span class="palette-label"[^>]*>.*?<\/div>)', lambda m: m.group(0)[:-6] + copy_btn_html + '</div>', content, flags=re.DOTALL)

    with open(hf, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"CLEANED/UPDATED HTML: {hf}")
