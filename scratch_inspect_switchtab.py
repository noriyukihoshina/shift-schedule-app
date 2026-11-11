with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
pos = text.find('function switchTab')
if pos != -1:
    print(text[pos:pos+1500])

for m in re.finditer(r'renderCheckTable', text):
    idx = m.start()
    print('--- renderCheckTable call ---')
    print(text[max(0, idx-100):min(len(text), idx+150)].replace('\n', ' '))
