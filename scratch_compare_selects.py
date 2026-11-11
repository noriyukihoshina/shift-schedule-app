import re

with open('1f.html', 'r', encoding='utf-8') as f:
    text = f.read()

matches = re.findall(r'<select[^>]*id="[^"]*"[^>]*>', text)
for m in matches:
    print('1f.html:', m)

with open('master.html', 'r', encoding='utf-8') as f:
    m_text = f.read()

matches = re.findall(r'<select[^>]*id="[^"]*"[^>]*>', m_text)
for m in matches:
    print('master.html:', m)
