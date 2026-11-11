with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'lifeSection|isVisiting|isDayCare|ハ3|ハ南|Cl1|Cl2', text)]
for idx in matches[:20]:
    print('--- MATCH ---')
    print(text[max(0, idx-60):min(len(text), idx+140)].replace('\n', ' '))
