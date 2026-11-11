# -*- coding: utf-8 -*-
import os, glob, re

html_files = [
    'index.html', '1f.html', '1階病棟.html', '2f.html', '2階病棟.html',
    '3f.html', '3階病棟.html', 'south.html', '南病棟.html', 'st.html', 'ST.html',
    'life.html', '生活期.html', '生活期_管理者.html', 'master.html', 'マスターテーブル.html'
]

opt_pattern = re.compile(r'\s*<option value="2025-[^"]*">[^<]*</option>')
saved_pattern = re.compile(r'<div[^>]*>\s*<span[^>]*>📁 保存済み期間:[^<]*</span>\s*<select id="savedTermsSelect"[^>]*>[\s\S]*?</select>\s*</div>', re.DOTALL)
save_btn_pattern = re.compile(r'<button[^>]*class="[^"]*manual-save-btn[^"]*"[^>]*>[\s\S]*?💾 保存</button>')

for hf in html_files:
    if not os.path.exists(hf):
        continue
    with open(hf, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. 2025年オプション削除
    content = opt_pattern.sub('', content)

    # 2. 保存済み期間削除
    content = saved_pattern.sub('', content)

    # 3. 手動保存ボタン削除
    content = save_btn_pattern.sub('', content)

    with open(hf, 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)
    print(f"CLEANED: {hf}")
