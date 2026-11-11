import sys
sys.stdout.reconfigure(encoding='utf-8')
import re

with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

for m in re.finditer(r'function\s+renderMasterIntegrationView\s*\(', text):
    start = m.start()
    print("Definition at line:", text[:start].count('\n') + 1)
    print(text[start:start+1000])
