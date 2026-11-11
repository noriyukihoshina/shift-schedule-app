with open('master.html', 'r', encoding='utf-8') as f:
    text = f.read()

import re
m1 = re.search(r'<section id="checkTab"[^>]*>', text)
if m1:
    idx = m1.start()
    print('=== checkTab ===')
    print(text[idx:idx+600])

m2 = re.search(r'<section id="statsTab"[^>]*>', text)
if m2:
    idx2 = m2.start()
    print('=== statsTab ===')
    print(text[idx2:idx2+600])
