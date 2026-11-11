with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = re.findall(r'localStorage\.setItem\([\'"][^\'"]+[\'"]', text)
for m in sorted(list(set(matches)))[:25]:
    print(m)
