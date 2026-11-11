with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
for m in re.finditer(r'eliminateSingleDayWork\s*\(', text):
    pos = m.start()
    print('--- def/call ---')
    print(text[pos-20:pos+300])
