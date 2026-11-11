with open('master.html', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [l.strip() for l in text.split('\n') if any(k in l for k in ['希望入力', '修正作業エリア', '最終チェック', 'ダッシュボード', 'tab'])]
print("Matches in master.html:")
for m in matches[:15]:
    print(" ", m)
