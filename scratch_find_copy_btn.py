with open('master.html', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'Excelへ一発貼り付け用コピー', text)]
for idx in matches:
    print('--- match ---')
    print(text[idx-200:idx+250])
