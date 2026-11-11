with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'termSelect', text)]
print('termSelect in app.js at:', matches)
for m in matches:
    print('--- at', m, '---')
    print(text[max(0, m-50):min(len(text), m+200)])
