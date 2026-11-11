with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
for m in re.finditer(r'currentGrid', text):
    pos = m.start()
    print('---')
    print(text[max(0, pos-60):min(len(text), pos+140)].replace('\n', ' '))
