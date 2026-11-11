import re

with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

matches = [m.start() for m in re.finditer(r'定数|8時.*定数|南.*8時', text)]
print('Found matches in app.js:', len(matches))
for idx in matches:
    print('--- MATCH ---')
    print(text[max(0, idx-50):min(len(text), idx+250)])
