with open('style.css', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'border-thickest-right', text)]
for idx in matches:
    print(text[max(0, idx-100):min(len(text), idx+200)])
