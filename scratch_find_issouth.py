with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'if\s*\(\s*this\.isSouth\s*\)', text)]
for idx in matches:
    print('Match at:', idx)
    print(text[idx:idx+1500])
