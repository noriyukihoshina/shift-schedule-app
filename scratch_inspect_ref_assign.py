with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'handleAutoAssignRefreshHolidays', text)]
for idx in matches:
    print(text[idx:idx+1500])
