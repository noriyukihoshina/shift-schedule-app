with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'8時.*不足|不足.*8時', text)]
print('Matches in app.js:', len(matches))
for idx in matches:
    print(text[max(0, idx-100):min(len(text), idx+200)])
