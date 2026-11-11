with open('life.html', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'特殊勤務', text)]
for m in matches:
    print('--- at', m)
    print(text[max(0, m-80):min(len(text), m+200)])
