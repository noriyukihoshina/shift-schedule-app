with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'checkTbody\.innerHTML =', text)]
for idx in matches:
    print('---')
    print(text[max(0, idx-60):min(len(text), idx+140)].replace('\n', ' '))
