with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'リフ.*公休|公休.*リフ|refDays', text)]
print('Matches in solver.js:', len(matches))
for idx in matches[:10]:
    print('=== match ===')
    print(text[max(0, idx-50):min(len(text), idx+200)])
