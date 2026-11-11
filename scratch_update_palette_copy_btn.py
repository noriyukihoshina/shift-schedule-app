import glob
import re

for fname in ['1f.html', '1階病棟.html', '2f.html', '2階病棟.html', '3f.html', '3階病棟.html', 'south.html', '南病棟.html', 'ST.html', 'life.html', '生活期.html', '生活期_管理者.html', 'index.html', 'master.html', 'マスターテーブル.html']:
    try:
        with open(fname, 'r', encoding='utf-8') as f:
            text = f.read()

        # スクロールボタンの隣にある古いコピペモードボタンを削除
        old_scroll_btn = re.search(r'<button[^>]*class="[^"]*copy-mode-btn[^"]*"[^>]*>[\s\S]*?コピペモード[\s\S]*?</button>', text)
        if old_scroll_btn:
            text = text[:old_scroll_btn.start()] + text[old_scroll_btn.end():]

        # 記号パレット内の出張ボタンの直後にコピペモードボタンを挿入
        # <button class="palette-btn ... data-sym="出張" ...>出張</button>
        trip_match = re.search(r'(<button[^>]*data-sym="出張"[^>]*>[\s\S]*?出張[\s\S]*?</button>)', text)
        if trip_match and 'id="copyModeToggleBtn"' not in text:
            btn_html = '\n                    <button type="button" class="btn btn-outline copy-mode-btn" id="copyModeToggleBtn" style="font-size: 0.82rem; padding: 3px 8px; font-weight: 700; margin-left: 6px; border-color: #6366f1; color: #4f46e5; background: #eef2ff;" title="コピペモード: セルを選択してCtrl+Cでコピー、Ctrl+Vで貼り付け">📋 コピペ</button>'
            insert_pos = trip_match.end()
            text = text[:insert_pos] + btn_html + text[insert_pos:]

        with open(fname, 'w', encoding='utf-8') as f:
            f.write(text)
        print(f"Updated palette copy button in {fname}")
    except Exception as e:
        print(f"Error {fname}: {e}")
