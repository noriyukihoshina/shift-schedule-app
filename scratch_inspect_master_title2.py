with open('master.html', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'最終チェック', text)]
for idx in matches:
    print('=== 最終チェック in master.html ===')
    print(text[max(0, idx-100):min(len(text), idx+150)])
