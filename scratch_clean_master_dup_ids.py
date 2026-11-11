# -*- coding: utf-8 -*-
"""
master.html, index.html, マスターテーブル.html の改修:
1. 非表示 inputTab 内の重複 ID (termStartDate, termEndDateDisplay, termTitleBadge, termDaysBadge) をリネーム
2. checkTab ツールバーが唯一の正規 ID を持つように保証
"""
import re

master_files = ['master.html', 'index.html', 'マスターテーブル.html']

for fn in master_files:
    try:
        with open(fn, 'r', encoding='utf-8') as f:
            content = f.read()

        # inputTab セクションを特定
        m = re.search(r'(<section id="inputTab"[\s\S]*?</section>)', content)
        if m:
            input_tab_html = m.group(1)
            # inputTab 内の ID をすべて hiddenOld... に置換
            modified_input_tab = input_tab_html
            modified_input_tab = modified_input_tab.replace('id="termStartDate"', 'id="hiddenOldTermStartDate"')
            modified_input_tab = modified_input_tab.replace('id="termEndDateDisplay"', 'id="hiddenOldTermEndDateDisplay"')
            modified_input_tab = modified_input_tab.replace('id="termTitleBadge"', 'id="hiddenOldTermTitleBadge"')
            modified_input_tab = modified_input_tab.replace('id="termDaysBadge"', 'id="hiddenOldTermDaysBadge"')
            modified_input_tab = modified_input_tab.replace('id="termSelect"', 'id="hiddenOldTermSelect"')

            content = content[:m.start(1)] + modified_input_tab + content[m.end(1):]
            print(f"Replaced duplicate IDs inside inputTab in {fn}")

        with open(fn, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Saved {fn}")
    except Exception as e:
        print(f"Error {fn}: {e}")
