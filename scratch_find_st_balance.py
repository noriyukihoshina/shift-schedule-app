with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
for m in re.finditer(r'balanceWorkforceForST', text):
    pos = m.start()
    print('---')
    print(text[pos-20:pos+200])
