# 全HTMLファイルの inputTab に コピペモードボタン を設置するスクリプト

import glob

html_files = [
    'index.html', 'master.html', '1f.html', '2f.html', '3f.html', 'south.html', 'life.html', 'ST.html',
    'マスターテーブル.html', '生活期.html', '生活期_管理者.html', '1階病棟.html', '2階病棟.html', '3階病棟.html', '南病棟.html'
]

target_str = '''                        <button type="button" class="scroll-btn" data-target="inputSheetWrapper" data-dir="right" title="表を右（〜28日・属性）へスクロール">
                            右へ ▶
                        </button>'''

replacement_str = '''                        <button type="button" class="scroll-btn" data-target="inputSheetWrapper" data-dir="right" title="表を右（〜28日・属性）へスクロール">
                            右へ ▶
                        </button>
                    <button type="button" class="btn btn-sm btn-outline-primary copy-mode-btn" style="font-weight:700; margin-left:8px; padding:2px 8px;" title="セルを選択してCtrl+Cでコピー、別セルでCtrl+Vで貼り付け">📋 コピペモード</button>'''

modified = []
for hf in html_files:
    try:
        with open(hf, 'r', encoding='utf-8') as f:
            content = f.read()
        if target_str in content and 'data-target="inputSheetWrapper"' in content:
            if 'copy-mode-btn" style="font-weight:700; margin-left:8px; padding:2px 8px;" title="セルを選択してCtrl+Cでコピー' not in content:
                content = content.replace(target_str, replacement_str, 1)
                with open(hf, 'w', encoding='utf-8') as f:
                    f.write(content)
                modified.append(hf)
    except Exception as e:
        print(f"Error {hf}: {e}")

print(f"Added copy mode button to inputTab in {len(modified)} files: {modified}")
