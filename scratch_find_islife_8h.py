with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'isLife.*8時|8時.*isLife', text)]
for idx in matches:
    print('---')
    print(text[max(0, idx-50):min(len(text), idx+150)].replace('\n', ' '))
