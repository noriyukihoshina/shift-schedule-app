with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'solveBtn|autoSolveBtn|solveBaseSchedule', text)]
print('Matches count:', len(matches))
for idx in matches[:10]:
    print(text[max(0, idx-50):min(len(text), idx+150)])
