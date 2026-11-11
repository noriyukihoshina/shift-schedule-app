with open('master.html', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'<select', text)]
for idx in matches:
    print('=== <select in master.html ===')
    print(text[idx:idx+400])
