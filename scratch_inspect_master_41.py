with open('master.html', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'4/1', text)]
for idx in matches:
    print('=== 4/1 in master.html ===')
    print(text[max(0, idx-50):min(len(text), idx+100)])
