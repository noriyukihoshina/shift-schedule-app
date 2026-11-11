with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
for m in re.finditer(r'function renderCheckTable', text):
    idx = m.start()
    print('--- def ---')
    print(text[idx:idx+1500])

for m in re.finditer(r'renderCheckTable\(', text):
    idx = m.start()
    print('--- call ---')
    print(text[max(0, idx-50):min(len(text), idx+100)].replace('\n', ' '))
