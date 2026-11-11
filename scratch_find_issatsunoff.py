with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'isSatSunOff', text)]
print('isSatSunOff matches at:', matches)
for m in matches:
    print('--- at', m, '---')
    print(text[max(0, m-80):min(len(text), m+200)])
