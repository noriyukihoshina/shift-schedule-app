with open('life.html', 'r', encoding='utf-8') as f:
    text = f.read()

import re
btns = re.findall(r'<button[^>]*>.*?</button>', text)
for b in btns:
    if '特殊' in b or '自律' in b or '一括' in b or 'コピペ' in b or '保存' in b:
        print(b)
