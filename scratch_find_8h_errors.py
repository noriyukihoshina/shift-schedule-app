with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'errors\.push\(.*8時', text)]
print('Matches in solver.js:', len(matches))
for idx in matches:
    print(text[max(0, idx-50):min(len(text), idx+200)])
