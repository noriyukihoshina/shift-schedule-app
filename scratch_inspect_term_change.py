import re

with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

matches = [m.start() for m in re.finditer(r'termSelect', text)]
print('Found termSelect in app.js:', len(matches))
for idx in matches:
    print('--- MATCH ---')
    print(text[max(0, idx-100):min(len(text), idx+300)])
