with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
for m in re.finditer(r'checkTableBody', text):
    pos = m.start()
    print('---')
    print(text[max(0, pos-40):min(len(text), pos+150)].replace('\n', ' '))
