with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'renderCheckTable', text)]
print('renderCheckTable matches count:', len(matches))
for idx in matches:
    print(text[max(0, idx-100):min(len(text), idx+150)])
