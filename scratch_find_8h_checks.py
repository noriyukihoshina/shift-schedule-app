with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'8時.*不足|8時.*要件|8時開始が0名', text)]
for idx in matches:
    print('---')
    print(text[max(0, idx-100):min(len(text), idx+200)])
