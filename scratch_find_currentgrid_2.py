with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = list(re.finditer(r'currentGrid', text))
print(f'Total matches: {len(matches)}')
for i, m in enumerate(matches[15:]):
    pos = m.start()
    print(f'--- {i+15} ---')
    print(text[max(0, pos-60):min(len(text), pos+140)].replace('\n', ' '))
