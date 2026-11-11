with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'SYMBOLS\.H8|"8時"|\'8時\'', text)]
for idx in matches:
    line_no = text.count('\n', 0, idx) + 1
    snippet = text[idx:idx+80].replace('\n', ' ')
    print(f'line {line_no}: {snippet}')
