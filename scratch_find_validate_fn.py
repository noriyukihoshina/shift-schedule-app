with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'function validateScheduleGrid', text)]
print('Matches count:', len(matches))
for idx in matches:
    print(text[idx:idx+2500])
