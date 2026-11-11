with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
for m in re.finditer(r'checkTable|finalGrid|checkTab|特殊勤務を入れる', text):
    idx = m.start()
    print('--- match ---')
    print(text[max(0, idx-50):min(len(text), idx+100)].replace('\n', ' '))
