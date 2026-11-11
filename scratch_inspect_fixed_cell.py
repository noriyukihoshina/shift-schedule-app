with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'fixed-cell|isFixed|autoAssignedRefKeys', text)]
for idx in matches[:15]:
    print('---')
    print(text[max(0, idx-50):min(len(text), idx+150)].replace('\n', ' '))
