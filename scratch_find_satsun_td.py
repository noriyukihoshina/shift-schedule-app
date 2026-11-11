with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'title=[\'"]土日休', text)]
for m in matches:
    print('--- match at', m)
    print(text[m-50:m+250])
