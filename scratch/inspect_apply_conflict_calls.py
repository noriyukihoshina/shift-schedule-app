import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'applyOutputConflictHighlights', text)]
for p in matches:
    print("--- call site ---")
    print(text[p-50:p+250])
