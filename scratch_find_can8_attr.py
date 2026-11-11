with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'data-flag="can8"', text)]
print('data-flag="can8" matches count:', len(matches))
for idx in matches:
    print(text[idx-100:idx+300])
