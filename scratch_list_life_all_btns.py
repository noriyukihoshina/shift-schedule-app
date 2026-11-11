with open('life.html', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = re.findall(r'<button[^>]*>[^<]*</button>', text)
for m in matches:
    print(m)
