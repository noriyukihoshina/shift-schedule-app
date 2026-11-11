with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'barColor|background:.*#|background-color', text)]
print('Matches count:', len(matches))
for idx in matches:
    sub = text[max(0, idx-50):min(len(text), idx+150)]
    if '土' in sub or '日' in sub or '祝' in sub or 'chart' in sub or 'bar' in sub:
        print('=== bar color match ===')
        print(sub)
